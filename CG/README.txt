Due to CORS restrictions, image data can only be read from the same origin, or where CORS headers are provided.
To get around this, the scene uses Node to create a web server (and therefore an origin point).

===========================HOW TO VIEW THE SCENE===========================
To be able to view the scene you MUST:
- Extract all files from the outer zip folder into a clean working directory
- Make sure Node.js is installed/running on your device (if you have a managed desktop, it can be launched from the app launcher)
- Open a command prompt window and navigate to the directory containing this readme
- Type 'npm install' and wait for initialisation to occur (download all required packages)
- Type 'npm start'
- Navigate to 'localhost:8080' in your favourite browser*
- If everything was successful, you should see something similar to the scene.png screenshot

*This scene has been tested in Chrome 80 and Edge 44

Please note that many objects are movable in this scene.
However, you can only move the selected object, otherwise there would be too many keybinds.
Use the [ & ] keys to change the currently selected item. The UI should tell you what is currently selected and
the keybinds that object has.

The photos in /res are all my own.


========MANUAL INFORMATION. YOU SHOULDN'T NEED THIS========

Node.js modules required:
- Express. This should install with npm init


Required libraries:
- glMatrix. gl-matrix-min.js has been bundled already so no further action should be required.

