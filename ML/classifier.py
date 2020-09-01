"""
Datasets must be stored in anonymisedData/ relative to this program's working directory.
If all of the imported modules are on your machine, running the classifiers should be as simple as executing the Python script directly.
The program will output some data analysis stuff first, then it will start running models.
After each model, it will display a score in the terminal and show a GUI for the confusion matrix.
This is a useful visual display of each model's performance but YOU MUST CLOSE THIS GUI FOR EXECUTION TO CONTINUE.
The first model runs under default settings, then runs an exhaustive GridSearch to tune hyperparameters. The confusion matrix will be shown after both of these.
The second model will then run in the same way as the first but this may take a couple of minutes to complete.
"""
import numpy as np
import pandas as pd
import scipy as sc
import matplotlib.pyplot as plt
from pathlib import Path
from sklearn.base import BaseEstimator, TransformerMixin
from sklearn.impute import SimpleImputer
from sklearn.pipeline import Pipeline
from sklearn.preprocessing import OrdinalEncoder, StandardScaler, RobustScaler
from sklearn.compose import ColumnTransformer
from sklearn.linear_model import LogisticRegression
from sklearn.tree import DecisionTreeClassifier
from sklearn.ensemble import RandomForestClassifier
from sklearn.svm import SVC
from sklearn.model_selection import train_test_split, GridSearchCV
from sklearn.metrics import confusion_matrix, plot_confusion_matrix

#Load the data from given path string, and read CSV into pandas DataFrame
def loadData(path):
    p = Path(path)
    return pd.read_csv(p)

#Wrapper to load data from the datasets folder more quickly
def loadStudentDataCSV(file):
    print('Attempting to load ' + file + '.csv')
    return loadData('anonymisedData/' + file + '.csv')

"""Remove rows from the pandas DataFrame series where a column has a specified value
Do the replacement inplace"""
def dropRows(data, key, value):
    data.drop(data[data[key] == value].index, inplace=True)

"""Convert (possibly dirty) percentage ranges to regular numerical ranges
in the format 00-00 using a simple regex"""
def pctRangeToNumRange(data, key):
    data[key] = data[key].str.replace('[^0-9\\-]', '')

"""Fill a pandas DataFrame series null values with the specified value
Do the replacement inplace"""
def fillNa(data, key, value):
    data[key].fillna(value, inplace=True)

def getData(studentVle, studentInfo):
    #Set the keys to join on
    keyColumns = ['code_module', 'code_presentation', 'id_student']
    #Group the vle data by the number of clicks (aggregate number of clicks)
    studentVleGrouped = studentVle.groupby(keyColumns)['sum_click'].sum()
    #Merge the student general info with the vle data
    mergedStudentVleInfo = studentInfo.merge(pd.DataFrame({'sum_click': studentVleGrouped}), left_on=keyColumns, right_index=True)
    #Ditch any withdrawn students. Data for these will be incomplete and we only care about pass/fail
    dropRows(mergedStudentVleInfo, 'final_result', 'Withdrawn')
    #Do some cleanup on the imd_band which has some missing % symbols
    pctRangeToNumRange(mergedStudentVleInfo, 'imd_band')
    #Return the data with some simple cleaning
    return mergedStudentVleInfo

#Print a subset of the data rows
def dataPeek(data, fields, start=15, end=20):
    print(data[fields][start:end])

"""Run encoder transformations for given fields. We need DataFrames for analysis which is why we don't use
the pipelines. Don't use this function for generating ML model features or labels."""
def analysisTransform(dataStore, encoder, fields):
    for field in fields:
        #Run the encoder on the field. Flatten the resulting numpy ndarray
        dataStore[field] = encoder.fit_transform(dataStore[[field]]).flatten()
    return dataStore

"""
Generate some basic analysis information such as correlation and quartiles for the data.
Need to use encoders to make ordinals numeric
"""
def dataAnalysis(dataStore):
    ds = dataStore.copy()
    allFields = ['imd_band', 'age_band', 'gender', 'region', 'disability', 'highest_education', 'final_result', 'sum_click']
    ds = ds[allFields]
    oe = NullSafeOrdinalEncoder(strategy='median')
    me = MappedEncoder(categories={'Distinction': 1, 'Pass': 1, 'Fail': 0})
    qe = NullSafeOrdinalEncoder(strategy='median', categories=[[
            'No Formal quals',
            'Lower Than A Level',
            'A Level or Equivalent',
            'HE Qualification',
            'Post Graduate Qualification',
        ]])
    ds = analysisTransform(ds, oe, ['imd_band', 'age_band', 'gender', 'region', 'disability'])
    ds = analysisTransform(ds, qe, ['highest_education'])
    ds = analysisTransform(ds, me, ['final_result'])
    correlation = ds.corr()
    print(correlation['final_result'].sort_values(ascending=False))
    print('\n')
    print(ds.describe())

#Return the score for the given model
def scoreModel(model, XTest, yTest, name):
    print("Score for " + name + " is " + str(model.score(XTest, yTest) * 100) + "%")

#Plot the confusion matrix for the model using the sklearn metrics
def plotConfusionMatrix(model, XTest, yTest, name):
    p = plot_confusion_matrix(
        model,
        XTest,
        yTest,
        display_labels=['Fail', 'Pass'],
        cmap=plt.cm.Blues,
        normalize='true')
    p.ax_.set_title('Confusion matrix for ' + name)
    plt.show()

#Fit the given model, then score and plot confusion matrix
def fitAndPlot(model, XTrain, yTrain, XTest, yTest, name):
    print("Running fitAndPlot for: " + name)
    model.fit(XTrain, yTrain)
    scoreModel(model, XTest, yTest, name)
    plotConfusionMatrix(model, XTest, yTest, name)

"""
Run a grid search on the given model and plot the tuned result.
Experimentation has shown that we have a large number of false positives so we attempt to tune for precision
"""
def tune(model, params, XTrain, yTrain, XTest, yTest, name):
    classifier = model.__class__
    clf = GridSearchCV(classifier(), params, cv=5, verbose=True, n_jobs=-1, scoring='precision')
    fitAndPlot(clf, XTrain, yTrain, XTest, yTest, name + ' Tuned')
    print('Precision optimised params are: ' + str(clf.best_params_))

#Generate a complete model. First a basic version using the defaults, then try to tune
def model(model, params, XTrain, yTrain, XTest, yTest, name):
    fitAndPlot(model, XTrain, yTrain, XTest, yTest, name)
    tune(model, params, XTrain, yTrain, XTest, yTest, name)

"""
A custom version of the OrdinalEncoder that can handle NaN values in data.
This currently only supports one column to be passed at a time. We could fix this later, but don't need to at the moment
"""
class NullSafeOrdinalEncoder(BaseEstimator, TransformerMixin):
    def __init__(self, strategy, categories='auto'):
        self.strategy = strategy
        self.categories = categories
    def fit(self, X, y=None):
        return self
    def transform(self, X):
        #Remove every row with a NaN value and get both the set with and without NaNs
        nullRemoved = X.dropna()
        nullOnly = X[~X.index.isin(nullRemoved.index)]
        #Create encoder for categories
        oe = OrdinalEncoder(self.categories)
        #Run the encoder on the safe (no NaN) data and store in a new DataFrame with same indexing
        encoded = pd.DataFrame(oe.fit_transform(nullRemoved), index=nullRemoved.index)
        #Concat the encoded data with the null-containing data
        result = pd.concat([encoded, nullOnly])
        #Resort the keys or everything ends up out of order
        result.sort_index(inplace=True)
        #Fill the blanks and return the ndarray
        imputer = SimpleImputer(strategy=self.strategy)
        return imputer.fit_transform(result)

"""
Simple custom encoder for ordinals using a specific ordering where the categories don't follow
a lexicographic ordering that can be automatically detected and give the desired result
"""
class MappedEncoder(BaseEstimator, TransformerMixin):
    def __init__(self, categories={}):
        self.categories = categories
    def fit(self, X, y=None):
        return self
    def transform(self, X):
        Z = pd.DataFrame()
        for column in X:
            Z[column] = X[column].map(self.categories)
        return Z.to_numpy()

def getPipelines(scaler):
    stdNumPipeline = Pipeline([
            ('imputer', SimpleImputer(strategy='median')),
            ('std_scaler', scaler),
        ])

    stdCatPipeline = Pipeline([
            ('encoder', NullSafeOrdinalEncoder(strategy='median')),
            ('std_scaler', scaler),
        ])

    qualCatPipeline = Pipeline([
            ('encoder', NullSafeOrdinalEncoder(strategy='median', categories=[[
                'No Formal quals',
                'Lower Than A Level',
                'A Level or Equivalent',
                'HE Qualification',
                'Post Graduate Qualification',
            ]])),
            ('std_scaler', scaler),
        ])

    disCatPipeline = Pipeline([
            ('encoder', NullSafeOrdinalEncoder(strategy='median', categories=[[
                'Y',
                'N'
            ]])),
            ('std_scaler', scaler),
        ])

    stdOutPipeline = Pipeline([
            ('encoder', MappedEncoder(categories={'Distinction': 1, 'Pass': 1, 'Fail': 0}))
        ])

    labelPipeline = ColumnTransformer([
            ('stdOut', stdOutPipeline, ['final_result']),
        ])

    featurePipeline = ColumnTransformer([
            ('stdNum', stdNumPipeline, ['sum_click']),
            ('stdCat', stdCatPipeline, ['imd_band']),
            ('qualCat', qualCatPipeline, ['highest_education']),
        ])

    return featurePipeline, labelPipeline

def getFeaturesAndLabels(scaler, trainSet, testSet):
    featurePipeline, labelPipeline = getPipelines(scaler)
    """Run transforms on the features and labels of both sets. We need to flatten labels since most
    transforms return a numpy ndarray and we only want one column for labels"""
    trainSetFeatures = featurePipeline.fit_transform(trainSet)
    trainSetLabels = labelPipeline.fit_transform(trainSet).flatten()
    testSetFeatures = featurePipeline.fit_transform(testSet)
    testSetLabels = labelPipeline.fit_transform(testSet).flatten()
    
    return trainSetFeatures, trainSetLabels, testSetFeatures, testSetLabels

print('Starting... Please wait while datasets are loaded\n')
#Load the data
studentVle = loadStudentDataCSV('studentVle')
studentInfo = loadStudentDataCSV('studentInfo')

dataPeek(studentInfo, ['imd_band', 'final_result'])
print('\n')
#Do some basic preprocessing such as merging and removing anything not of interest
dataStore = getData(studentVle, studentInfo)
#Look at some interesting features of the data
dataAnalysis(dataStore)
print('\n')
#Split our training and test set in 80:20 ratio. Seed the random index generator
trainSet, testSet = train_test_split(dataStore, test_size=0.2, random_state=42)


trainSetFeatures, trainSetLabels, testSetFeatures, testSetLabels = getFeaturesAndLabels(StandardScaler(), trainSet, testSet)

#Run a logistic classifier, then optimise it
paramGrid = [{'penalty' : ['elasticnet'], 'C' : np.logspace(-4, 4, 20), 'solver' : ['saga'], 'l1_ratio': np.linspace(0, 1, 20)}]
model(LogisticRegression(penalty='l1', solver='saga'), paramGrid, trainSetFeatures, trainSetLabels, testSetFeatures, testSetLabels, 'Logistic Classifier')

#Use a different pipeline with a different scaler since we can get better performance with a RobustScaler for an SVC
trainSetFeatures, trainSetLabels, testSetFeatures, testSetLabels = getFeaturesAndLabels(RobustScaler(), trainSet, testSet)

#Run an SVC, then optimise it. THIS MAY TAKE A COUPLE OF MINUTES. Tested on a 4C/8T CPU
paramGrid = [{'kernel': ['rbf'], 'gamma': [0.001, 0.0001], 'C': [1, 10, 100, 1000]}]
model(SVC(gamma='auto'), paramGrid, trainSetFeatures, trainSetLabels, testSetFeatures, testSetLabels, 'SVC')

#Cleanup just in case since the loaded data often remained in RAM for a while
del studentVle
del studentInfo
