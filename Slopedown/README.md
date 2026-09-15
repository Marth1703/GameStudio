### Slopedown

- Marvin Fischer
- WiSe22/23
- Medieninformatik 5. Semester
- Prima
- Prof. Jirka Dell'Oro-Friedl
- Game: https://marth1703.github.io/PrimaWiSe22/Slopedown/index.html
- Code: https://github.com/Marth1703/PrimaWiSe22/tree/main/Slopedown
- Design: https://marth1703.github.io/PrimaWiSe22/Slopedown/DesignSheet.pdf

### Interactions
                    
Input  | Effect
------------- | -------------
W  | Increses Speed forwards
A  | Slide left
S  | Brakes 
D  | Slide right
Space  | Hold and release to Execute Jump

### Criteria

|NR   | Criteria  |Explanation   |
| :------------ | :------------ | :------------ |
|1   |Units and Positions   | 0 is at the center of the stage, 1 is the size(width) of the avatar. |
|2   |Hierarchy   | Everything is attached to a Level graph so it is compact. Everything else consists of child Nodes |
|3   |Editor   | The general level is built in the editor, all the parts of the slope such as Trees, Boosts etc. are created with Code. This allows for an easy distribution of multiple nodes |
|4   |Scriptcomponents   | ScriptComponents were useful for all the events with Triggers. For example when entering the death plane or collecting coins.  |
|5   |Extend  | I extend classes from fc.Node because it allows me to create multiple entities with a set design with code. |
|6   |Sound   | There is background music and sound effects when collecting coins and receiving a boost.  |
|7   |VUI   | The interface shows all the basic useful information such as the current speed and the time.  |
|8   |Event-System   | The CustomEvents when falling or entering the finishline were somewhat useful because I can also execute them with a trigger. |
|9   |External Data   | The config file stores the angles the camera is set up with. These are fixed and somewhat arbitrary.|
|A   |Light   | Light is required so I can use a ShaderGouraud on my Terrain to give it more depth. I use a directional light for that.  |
|B   |Physics   | The whole game works with rigidbodies and forces. Gravity is also an essential part of the game. |
|E   |Animation   | The coins are animated to periodically change there size a bit to make them seems more present.  |