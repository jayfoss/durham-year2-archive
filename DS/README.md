On Windows:
- Make sure your Python version is >= 3.4 and you have Pyro4 installed. Run pip install Pyro4 if you don't
have pyro.
- Run the batch file to automatically start the nameserver, 3 backends, 1 frontend and 1+ clients
- (((If the batch file doesn't work, you can do this manually by launching each python file in the given order. If the default python version on your system is Python 2 then the system will try to start
on Python 2 which is not compatible. You must ensure you run it with the python3 command so modify the
batch file if necessary.)))
- Focus on the client window and follow the on-screen instructions to list items or place an order
- Whenever a request is made to the server, there is a 1 in 5 chance that the primary backend will "crash" and the system will be
forced to choose a new one. You can see when this happens in the terminal

On Linux:
- Make sure your Python version is >= 3.4 and you have Pyro4 installed. Run pip install Pyro4 if you don't
have pyro.
- Launch the nameserver, then 3 backends, 1 frontend and 1+ clients
- Focus on the client window and follow the on-screen instructions to list items or place an order
- Whenever a request is made to the server, there is a 1 in 5 chance that the primary backend will "crash" and the system will be
forced to choose a new one. You can see when this happens in the terminal

On Linux over SSH:
- The file justhungrycmdwrapperheadless.sh can be run to start the system but you must first:
	- chmod 700 justhungrycmdwrapperheadless.sh
- Running the system over SSH will not be optimal since all servers and the client will output to
the same terminal which means the order of display will be jumbled and it may not be obvious which print
corresponds to which part of the system.
