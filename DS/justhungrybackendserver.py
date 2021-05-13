import Pyro4
import Pyro4.errors
import urllib.request
import urllib.error
import urllib.parse
import json
import random

class BackupManager:
    def __init__(self, ns, replicaName):
        self.replicaName = replicaName
        self.ns = ns
        self.replicas = []
        self.conns = []
        
    def getReplicaNames(self, ns, ignore):
        replicas = ns.list(prefix='justhungry.backend.')
        backup = []
        for r in replicas:
            if r != ignore:
                backup.append(r)
        return backup

    def connectTo(self, replicas):
        conns = []
        for r in replicas:
            with Pyro4.Proxy('PYRONAME:' + r) as p:
                conns.append(p)
        return conns

    def updateReplication(self):
        replicas = self.getReplicaNames(self.ns, self.replicaName)
        newConns = []
        for r in replicas:
            if r not in self.replicas:
                newConns.append(r)
                self.replicas.append(r)
        self.conns += self.connectTo(newConns)

    def getReplicas(self):
        self.updateReplication()
        return self.conns

    def replicate(self, items):
        print('Replicating to backups')
        for r in self.getReplicas():
            success = r.replicate(items)
            if not success:
                print('Replication failed for a backup')

@Pyro4.behavior(instance_mode='single')
class JustHungryInventory:
    def __init__(self, bm):
        self.bm = bm
        self.items = {}
        self.generateTestStock()

    def generateTestStock(self):
        self.restockLocal('margarita pizza', 100, 10)
        self.restockLocal('hawaiian pizza', 80, 12)
        self.restockLocal('pepperoni pizza', 150, 10)
        self.restockLocal('special pizza', 5, 25)
        self.restockLocal('garlic bread', 200, 3)

    def restockLocal(self, name, quantity, price=None):
        if name not in self.items:
            if price is None:
                return
            self.items[name] = {}
            self.items[name]['name'] = name
            self.items[name]['price'] = price
            self.items[name]['quantity'] = 0
        if price is not None:
            self.items[name]['price'] = price
        self.items[name]['quantity'] += quantity
        return self.items.values()
    
    @Pyro4.expose
    def restock(self, name, quantity, price=None):
        if self.hasCrashed():
            return self.status()
        s = self.restockLocal(name, quantity, price)
        if s is None:
            return
        self.bm.replicate(self.items)
        return self.items.values()

    @Pyro4.expose
    def getContents(self):
        if self.hasCrashed():
            return self.status()
        return self.items.values()

    def inStock(self, name, quantity):
        if name not in self.items:
            return False
        return self.items[name]['quantity'] >= quantity

    def fulfillOrder(self, order):
        if not order['valid']:
            return
        for name, quantity in order['items'].items():
            self.items[name]['quantity'] -= quantity
        self.bm.replicate(self.items)

    @Pyro4.expose
    def order(self, order):
        if self.hasCrashed():
            return self.status()
        if len(order['items']) < 1:
            order['valid'] = False
            order['invalidReason'] = 'Failed to order: No items'
            return order
        for name, quantity in order['items'].items():
            order['total'] = 0
            order['issues'] = {}
            order['valid'] = True
            if not self.inStock(name, quantity):
                order['valid'] = False
                order['invalidReason'] = 'We do not have one or more items in stock at the quantity you would like'
                order['outOfStock'].append(name)
            else:
                order['total'] += self.items[name]['price'] * quantity
        if order['postcode'] is None or len(order['postcode']) < 1:
            order['valid'] = False
            order['invalidReason'] = 'Missing postcode'
            return order
        psCheck = self.checkPostcode(order['postcode'])
        if psCheck != True :
            order['valid'] = False
            if psCheck == False:
                order['invalidReason'] = 'Invalid postcode'
            else:
                order['invalidReason'] = 'Could not verify postcode. This is probably a problem our end'
            return order
        self.fulfillOrder(order)            
        return order

    @Pyro4.expose
    def replicate(self, items):
        print('Received replicated data')
        self.items = items
        return True

    def hasCrashed(self):
        return random.randint(0, 4) == 0
    
    def status(self, ok=False):
        if ok:
            return {'__serverStatus':'ok'}
        else:
            return {'__serverStatus':'crashed'}

    @Pyro4.expose
    def ping(self):
        #Smaller chance of the server crashing immediately
        if self.hasCrashed() and self.hasCrashed():
            return self.status()
        return 'pong'

    def checkPostcode(self, postcode):
        print('Using postcodes.io')
        match = self.checkPostcodePostcodesIO(postcode)
        if match is None:
            print('Using GetTheData')
            match = self.checkPostcodeGetTheData(postcode)
        return match

    def checkPostcodePostcodesIO(self, postcode):
        try:
            req = urllib.request.Request('https://api.postcodes.io/postcodes/' + urllib.parse.quote(postcode))
            response = urllib.request.urlopen(req)
            body = json.loads(response.read().decode('utf-8'))
            return body['status'] == 200
        except urllib.error.HTTPError as e:
            if e.code == 404:
                return False
            return None
        except urllib.error.URLError:
            return None
        except json.JSONDecodeError:
            return None
        except:
            return None

    def checkPostcodeGetTheData(self, postcode):
        try:
            req = urllib.request.Request('http://api.getthedata.com/postcode/' + urllib.parse.quote(postcode))
            response = urllib.request.urlopen(req)
            body = json.loads(response.read().decode('utf-8'))
            return body['status'] == 'match'
        except urllib.error.URLError:
            return None
        except json.JSONDecodeError:
            return None
        except:
            return None
  
def getRandomName():
    name = ''
    for i in range(20):
        name += random.choice('0123456789ABCDEF')
    return name

print('Just Hungry backend startup...')
with Pyro4.locateNS() as ns:
    with Pyro4.Daemon() as daemon:
        replicaName = 'justhungry.backend.' + getRandomName()
        print('This replica has id: ' + replicaName)
        bm = BackupManager(ns, replicaName)
        uri = daemon.register(JustHungryInventory(bm))
        ns.register(replicaName, uri)
        daemon.requestLoop()
    ns.remove(replicaName)
print('Just Hungry backend shutdown...')
