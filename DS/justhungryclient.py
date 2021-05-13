import Pyro4

running = True

def listFoods(foods):
    print('Available foods:')
    print('Item - Price - Quantity Available')
    for key, food in enumerate(foods):
        print(str(key + 1) + '. ' + food['name'] + ' - £' + str(food['price']) + ' - ' + str(food['quantity']))

def showOrderItemMenu(foods):
    listFoods(foods)
    foodChoice = input('Enter food id\n')
    try:
        f = int(foodChoice) - 1
        if 0 <= f < len(foods):
            quantity = input('Enter quantity (whole number)\n')
            try:
                q = int(quantity)
                if foods[f]['quantity'] >= q:
                    return (foods[f]['name'], q)
                else:
                    print('Not enough inventory available of requested food type')
                    return False
            except ValueError:
                print('The quantity you entered is not a number')
                return False
        else:
            print('The number you entered is not in the inventory')
            return False
    except ValueError:
        print('You did not enter a whole number for the food id')
        return False

def addShipping(order):
    order['name'] = input('Enter shipping name\n')
    order['line1'] = input('Enter shipping address line 1\n')
    order['line2'] = input('Enter shipping address line 2\n')
    order['city'] = input('Enter shipping address city\n')
    order['county'] = input('Enter shipping address county\n')
    order['postcode'] = input('Enter shipping address postcode\n')
    order['country'] = 'United Kingdom'
    return order

def showOrderContents(order):
    if len(order['items']) == 0:
        print('Order content is empty')
        return
    print('Item - Quantity')
    for item, quantity in order['items'].items():
        print(item + ' - ' +str(quantity))

def orderMenu(foods):
    currentOrder = {}
    currentOrder['items'] = {}
    ordering = True
    while ordering:
        print('===')
        print('1. Add item')
        print('2. Submit order')
        print('3. Show order contents')
        print('4. Cancel order')
        choice = input('Choose an option\n')
        if choice == '1':
            item = showOrderItemMenu(foods)
            if item != False:
                currentOrder['items'][item[0]] = item[1]
        elif choice == '2':
            return addShipping(currentOrder)
        elif choice == '3':
            showOrderContents(currentOrder)
        elif choice == '4':
            print('Closing order menu')
            return False
            ordering = False
        else:
            print('Invalid option')
    return False

def showOrderResult(resp):
    if type(resp) is not dict:
        print('Something went wrong')
        return
    if resp['valid'] == False:
        print(resp['invalidReason'])
        if 'outOfStock' in resp and len(resp['outOfStock']) > 0:
            print('Affected items:')
            print(str(resp['outOfStock']))
    else:
        print('Order submitted. Total cost: £' + str(resp['total']))

def checkCrash(resp):
    if type(resp) is dict and '__serverStatus' in resp and resp['__serverStatus'] == 'crashed':
        print('Something went very wrong and your request could not be processed.')
        return True
    return False

def showMenu(p):
    print('======')
    print('1. List available foodstuffs')
    print('2. Start a new order')
    print('3. Exit')
    option = input('Enter choice...\n')
    if option == '1':
        print('Getting food list...')
        foods = p.getFoods()
        if not checkCrash(foods):
            listFoods(foods)
    elif option == '2':
        print('Retrieving inventory and opening order menu...')
        foods = p.getFoods()
        if not checkCrash(foods):
            order = orderMenu(foods)
            if order != False:
                print('Submitting order...')
                resp = p.processOrder(order)
                if not checkCrash(resp):
                    showOrderResult(resp)
    elif option == '3':
        print('Come back soon')
        return False
    else:
        print('Invalid option')
    return True

print('Just Hungry client startup...')
with Pyro4.locateNS() as ns:
    print('Found name server')
    with Pyro4.Proxy('PYRONAME:justhungry.frontend') as p:
        print('Found frontend server')
        while running:
            running = showMenu(p)
print('Just Hungry client shutdown...')
