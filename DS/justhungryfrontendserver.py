import Pyro4
import Pyro4.errors

def getPrimaryServer(ns, current=None):
    ignore = None
    if current is not None and current != False:
        ignore = current._pyroUri.asString()[9:]
    replicas = ns.list(prefix='justhungry.backend.')
    for r in replicas:
        if ignore is not None and len(replicas) > 1 and r == ignore:
            continue
        with Pyro4.Proxy('PYRONAME:' + r) as p:
            print('Choosing a new primary server: ' + r)
            if p.ping() == 'pong':
                return p
    return False

@Pyro4.behavior(instance_mode='single')
class JustHungryFrontend:
    def __init__(self, inventory, ns):
        self.inventory = inventory
        self.ns = ns

    def request(self, fn, args):
        if self.inventory is None or self.inventory is False:
            self.inventory = getPrimaryServer(self.ns)
        resp = getattr(self.inventory, fn)(*args)
        attemptCount = 1
        while type(resp) is dict and '__serverStatus' in resp and resp['__serverStatus'] == 'crashed':
            print('Called replica crashed. Trying again...')
            if attemptCount >= 10:
                break
            self.inventory = getPrimaryServer(self.ns, self.inventory)
            resp = getattr(self.inventory, fn)(*args)
            attemptCount += 1
        return resp

    @Pyro4.expose
    def getFoods(self):
        return self.request('getContents', [])
    
    @Pyro4.expose
    def processOrder(self, order):
        return self.request('order', [order])

print('Just Hungry frontend startup...')
with Pyro4.locateNS() as ns:
    inventory = getPrimaryServer(ns)
    with Pyro4.Daemon() as daemon:
        uri = daemon.register(JustHungryFrontend(inventory, ns))
        ns.register('justhungry.frontend', uri)
        daemon.requestLoop()
    ns.remove('justhungry.frontend')
print('Just Hungry frontend shutdown...')
