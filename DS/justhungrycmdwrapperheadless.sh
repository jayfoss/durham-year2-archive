#!/bin/bash
python3 justhungrynameserver.py &
python3 justhungrybackendserver.py &
python3 justhungrybackendserver.py &
python3 justhungrybackendserver.py &
python3 justhungryfrontendserver.py &
python3 justhungryclient.py
kill %1; kill %2; kill %3; kill %4; kill %5
