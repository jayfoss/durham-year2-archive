import sys
import re
import random
from anytree import Node, RenderTree
from anytree.exporter import UniqueDotExporter
from datetime import datetime

def readFile(name):
    #Initialise the expected keys
    lineGroups = {
            'variables': None,
            'constants': None,
            'predicates': None,
            'equality': None,
            'connectives': None,
            'quantifiers': None,
            'formula': None
        }
    try:
        with open(name, 'r') as f:
            for l in f:
                if ':' in l:
                    decl = l.split(':')
                    if len(decl) > 2:
                        return (False, 'Bad key/value pair. Multiple colons on one declaration line')
                    if decl[0] not in lineGroups:
                        return (False, 'Unknown declaration key: ' + decl[0])
                    if lineGroups[decl[0]] is not None:
                        return (False, 'Duplicate declaration key: ' + decl[0])
                    lineGroups[decl[0]] = decl[1].strip()
                else:
                    if lineGroups['formula'] is not None:
                        lineGroups['formula'] += ' ' + l
            for key, value in lineGroups.items():
                if value is None:
                    return (False, 'Missing ' + key + ' declaration')
            """Add whitespace around separators. If this doubles up whitespace it doesn't matter
            since we will strip additional whitespace later"""
            lineGroups['formula'] = lineGroups['formula'].replace('(', ' ( ').replace(')', ' ) ').replace(',', ' , ')
            for key in lineGroups.keys():
                lineGroups[key] = ' '.join(lineGroups[key].split())
            return (True, lineGroups)
        return (False, 'Something went wrong reading the file ' + name)
    except:
        return (False, 'Failed to read file. It may not exist or you don\'t have permission to access it')

def gMatchRegex(l, name, reg, additionalCharacters=[]):
    s = ''
    for i, v in enumerate(additionalCharacters):
        if i < len(additionalCharacters) - 1:
            s += (v + ', ')
        else:
            s += v
    for i in l:
        if not re.match(reg, i):
            return (False, r'Invalid ' + name + ' name ' + i + ', ' + name + ' names must only contain alphanumeric characters or ' + s)
    return (True, name + ' entries are valid')

def checkUniqueness(data):
    definedSymbols = {}
    check = data['variables'] + data['constants'] + list(data['predicates'].keys()) + data['equality'] + data['connectives'] + data['quantifiers']
    for var in check:
        if var not in definedSymbols:
            definedSymbols[var] = None
        else:
            return (False, r'Duplicate symbol identifier ' + var)
    return (True, 'All symbols are unique')

def parseInput(lineGroups):
    data = {}
    reg = re.compile('^\w+$', re.A)
    data['variables'] = lineGroups['variables'].split()
    checkResult = gMatchRegex(data['variables'], 'variable', reg, ['_'])
    if not checkResult[0]:
        return checkResult
    data['constants'] = lineGroups['constants'].split()
    checkResult = gMatchRegex(data['constants'], 'constant', reg, ['_'])
    if not checkResult[0]:
        return checkResult
    data['predicates'] = {}
    predI = lineGroups['predicates'].split()
    for p in predI:
        opening = p.find('[')
        if opening == -1:
            return (False, 'Bad predicate declaration: Missing [ for ' + p)
        splitDecl = p.split('[')
        if splitDecl[1][-1] != ']':
            return (False, 'Bad predicate declaration: Missing ] for ' + p)
        arityStr = splitDecl[1][:-1]
        arity = -1
        try:
            arity = int(arityStr)
        except ValueError:
            return (False, 'Arity is not an integer for predicate' + p)
        if not re.match(reg, splitDecl[0]):
            return (False, 'Invalid predicate name ' + splitDecl[0] + ', predicate names must only contain alphanumeric characters or underscores')
        data['predicates'][splitDecl[0]] = arity
    reg = re.compile('^[\w\\\\\=]+$', re.A)
    data['equality'] = lineGroups['equality'].split()
    if len(data['equality']) != 1:
        return (False, 'Cardinality of equality is not 1')
    checkResult = gMatchRegex(data['equality'], 'equality', reg, ['_', '\\', '='])
    if not checkResult[0]:
        return checkResult
    reg = re.compile('^[\w\\\\]+$', re.A)
    data['connectives'] = lineGroups['connectives'].split()
    if len(data['connectives']) != 5:
        return (False, 'Cardinality of connectives is not 5')
    checkResult = gMatchRegex(data['connectives'], 'connective', reg, ['_', '\\'])
    if not checkResult[0]:
        return checkResult
    data['quantifiers'] = lineGroups['quantifiers'].split()
    if len(data['quantifiers']) != 2:
        return (False, 'Cardinality of quantifiers is not 2')
    checkResult = gMatchRegex(data['quantifiers'], 'quantifier', reg, ['_', '\\'])
    if not checkResult[0]:
        return checkResult
    checkResult = checkUniqueness(data)
    if not checkResult[0]:
        return checkResult
    data['formula'] = lineGroups['formula']
    return (True, data)

def writeGrammarToFile(G, infileName):
    outfileName = 'grammar_' + infileName
    terminals = 'Terminals ::='
    nonTerminals = 'Non-Terminals ::='
    with open(outfileName, 'w') as f:
        for k, v in G.items():
            f.write(k + '->')
            for i, rule in enumerate(v):
                for j, symbol in enumerate(rule):
                    f.write(symbol[1] + ('' if j == len(rule) - 1 else ' '))
                    if symbol[0]:
                        if symbol[1] not in terminals or symbol[1] == '':
                            terminals += ' ' + symbol[1] + ' '
                    else:
                        if symbol[1] not in nonTerminals:
                            nonTerminals += ' ' + symbol[1] + ' '
                #Add a pipe between production rule options
                if(i != len(v) - 1):
                    f.write('|')
            f.write('\n')
        f.write('\n' + terminals + '\n')
        f.write(nonTerminals + '\n')
        return True
    return False

def buildGrammarAndParseTable(language):
    NT = False
    T = True
    G = {}
    #Create the grammar we want with help from the input
    G[':variable'] = []
    for var in language['variables']:
        G[':variable'].append([(T, var)])
    G[':constant'] = []
    for const in language['constants']:
        G[':constant'].append([(T, const)])
    G[':bin_connective'] = []
    for conn in language['connectives'][:4]:
        G[':bin_connective'].append([(T, conn)])
    G[':un_connective'] = [[(T, language['connectives'][4])]]
    G[':quantifier'] = []
    for quan in language['quantifiers']:
        G[':quantifier'].append([(T, quan)])
    G[':predicate_id'] = []
    for pred in language['predicates'].keys():
        G[':predicate_id'].append([(T, pred)])
    G[':term'] = [
            [(NT, ':constant')],
            [(NT, ':variable')],
        ]
    G[':formula_bracketed'] = [
            [(NT, ':term'), (T, language['equality'][0]), (NT, ':term')],
            [(NT, ':formula'), (NT, ':bin_connective'), (NT, ':formula')]
        ]
    G[':predicate_vars_exp'] = [
            [(T, ','), (NT, ':predicate_vars')],
            [(T, '')]
        ]
    G[':predicate_vars'] = [
            [(NT, ':variable'), (NT, ':predicate_vars_exp')],
        ]
    G[':predicate'] = [
            [(NT, ':predicate_id'), (T, '('), (NT, ':predicate_vars'), (T, ')')],
        ]
    G[':formula'] = [
            [(NT, ':predicate')],
            [(NT, ':quantifier'), (NT, ':variable'), (NT, ':formula')],
            [(T, '('), (NT, ':formula_bracketed'), (T, ')')],
            [(NT, ':un_connective'), (NT, ':formula')],
        ]
    """
    We could generate this FIRST/FOLLOW set programmatically but since
    this task isn't to write an LL(1) compiler generator but to perform syntax
    analysis on FO logic formulae and the grammar is small, we might as well
    explicitly declare it to save time building a complex generator which will
    waste CPU time recreating every time the program is run
    """
    FIRST = {}
    FIRST[':variable'] = []
    for var in language['variables']:
        FIRST[':variable'].append([var])
    FIRST[':constant'] = []
    for const in language['constants']:
        FIRST[':constant'].append([const])
    FIRST[':bin_connective'] = []
    for conn in language['connectives'][:4]:
        FIRST[':bin_connective'].append([conn])
    FIRST[':un_connective'] = [[language['connectives'][4]]]
    FIRST[':quantifier'] = []
    for quan in language['quantifiers']:
        FIRST[':quantifier'].append([quan])
    FIRST[':predicate_id'] = []
    for pred in language['predicates'].keys():
        FIRST[':predicate_id'].append([pred])
    FIRST[':term'] = [
            flatten(FIRST[':constant']),
            flatten(FIRST[':variable'])
        ]
    FIRST[':predicate_vars_exp'] = [
            [','],
            ['']
        ]
    FIRST[':predicate_vars'] = [
            flatten(FIRST[':variable'])
        ]
    FIRST[':predicate'] = [
            flatten(FIRST[':predicate_id'])
        ]
    FIRST[':formula'] = [
            flatten(FIRST[':predicate']),
            flatten(FIRST[':quantifier']),
            ['('],
            flatten(FIRST[':un_connective'])
        ]
    FIRST[':formula_bracketed'] = [
            flatten(FIRST[':term']),
            flatten(FIRST[':formula'])
        ]
    terminals = []
    for v in G.values():
        for r in v:
            for tok in r:
                (term, symbol) = tok
                if term and symbol not in terminals:
                    terminals.append(symbol)
    terminals.append('\\0')
    M = {}
    for key in G.keys():
        M[key] = dict((el, None) for el in terminals)
    for k, v in FIRST.items():
        """Add the special case. The only element that is in our FOLLOW set
        based on our grammar."""
        if k == ':predicate_vars_exp':
            M[k][')'] = 1
        for i, e in enumerate(v):
            for terminal in e:
                M[k][terminal] = i
    return (G, M)

#Make a 2D array 1D
def flatten(arr):
    f = []
    for v in arr:
        f += v
    return f

def syntaxAnalysis(tokens, grammar, parseTable, declarations):
    #Make sure our token input ends with the end delimiter
    tokens.append('\\0')
    stack = [(True, '\\0'), (False, ':formula')]
    pos = 0
    rootTreeNode = Node(':formula', id='root')
    currentTreeNode = None
    treeStack = [Node('\\0'), rootTreeNode]
    currentPredicate = None
    currentPredicateVarCount = 0
    while len(stack) > 0:
        (isTerminating, stok) = stack.pop()
        if len(treeStack) > 1:
            currentTreeNode = treeStack.pop()
        token = tokens[pos]
        if isTerminating:
            if stok == ')' and currentPredicate is not None:
                #Check that predicate arity is as expected
                if declarations['predicates'][currentPredicate] != currentPredicateVarCount:
                    return (False, r'Invalid number of variables for predicate ' + currentPredicate + ' ending at position ' + str(pos + 1) + '. Expected ' + str(declarations['predicates'][currentPredicate]) + ' but got ' + str(currentPredicateVarCount) + '.', None)
                currentPredicate = None
                currentPredicateVarCount = 0
            if token == stok:
                pos += 1
                if token == '\\0':
                    return (True, 'Given formula was valid', rootTreeNode)
            else:
                return (False, r'Unexpected token ' + token + ' in position ' + str(pos + 1) + '.', None)
        else:
            if token not in parseTable[stok]:
                return (False, r'Unrecognized token ' + token + ' in position ' + str(pos + 1) + '.', None)
            ruleId = parseTable[stok][token]
            if ruleId is None:
                return (False, r'Syntax error at ' + token + ' in position ' + str(pos + 1) + '.', None)
            production = grammar[stok][ruleId]
            if(len(production) < 1):
                return (False, r'Found a bad production for token ' + token + ' in position ' + str(pos + 1) + '.', None)
            for p in reversed(production):
                #The empty string shouldn't be appended. This will mess with further rules
                if p[1] == '':
                    continue
                stack.append(p)
            for p in reversed(production):
                parentNode = currentTreeNode
                if currentTreeNode is None:
                    parentNode = rootTreeNode
                #Make sure we escape backslashes so graphviz can display node names as expected
                newNode = Node(p[1].replace('\\', '\\\\'), parent=parentNode, id=genNodeId())
                #Don't append the empty string
                if p[1] != '':
                    treeStack.append(newNode)
            """We need to process nodes in reverse order for the stack but
            children will be R to L in display so flip them"""
            if currentTreeNode is not None:
                currentTreeNode.children = currentTreeNode.children[::-1]

            #Count the variables in a predicate to ensure we match arity
            if stok == ':predicate_id':
                currentPredicate = token
                currentPredicateVarCount = 0
            if stok == ':predicate_vars':
                currentPredicateVarCount += 1

#Generate a parse tree from the given root node
def genParseTreeImage(root, infileName):
    outfileName = 'parsetree_' + infileName.split('.')[0] + '.png'
    UniqueDotExporter(root).to_picture(outfileName)

#Generate a random id. Use this for anytree nodes to ensure uniqueness
def genNodeId():
    name = ''
    for i in range(20):
        name += random.choice('0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZ')
    return name

#Log wrapper. Output log entries with [TIME][FILE NAME] ENTRY MESSAGE
def log(fp, inputfileName, message):
    stamp = '[' + str(datetime.now()) + ']'
    inFileName = '[' + inputfileName + ']'
    entry = stamp + inFileName + ' ' + message
    fp.write(entry + '\n')

def run(inputfileName):
    with open('focompiler_log.txt', 'a') as f:
        print('Starting. Please see log file focompiler_log.txt for more information')
        log(f, inputfileName, '=====')
        log(f, inputfileName, 'Opening file...')
        """Read the file. Log and stop if the basic format of the file is wrong.
        Will also split the formula into tokens"""
        fileContent = readFile(inputfileName)
        if fileContent[0] == False:
            print(fileContent[1])
            log(f, inputfileName, fileContent[1])
            return
        else:
            log(f, inputfileName, 'Read file successfully')
        #Parses all the declarations
        inp = parseInput(fileContent[1])
        if inp[0] == False:
            print(inp[1])
            log(f, inputfileName, inp[1])
            return
        else:
            log(f, inputfileName, 'Parsed symbol declarations successfully')
        #The parse table is built based on the grammar so do both together
        grammar, parseTable = buildGrammarAndParseTable(inp[1])
        grammarWrite = writeGrammarToFile(grammar, inputfileName)
        if not grammarWrite:
            log(f, inputfileName, 'Failed to write the grammar to file. Skipping...')
        else:
            log(f, inputfileName, 'Grammar written to file successfully. It will be prefixed with grammar_')
        log(f, inputfileName, 'Performing syntax analysis on formula...')
        result, message, tree = syntaxAnalysis(inp[1]['formula'].split(), grammar, parseTable, inp[1])
        log(f, inputfileName, message)
        print(message)
        if result == True:
            log(f, inputfileName, 'Attempting to draw parse tree to PNG. Check output file...')
            genParseTreeImage(tree, inputfileName)
            
#If the command line argument exists, use it. If not default to prompting
if len(sys.argv) > 1:       
    run(sys.argv[1])
else:
    filename = input('Enter the name of the file you would like to parse:\n')
    run(filename)
