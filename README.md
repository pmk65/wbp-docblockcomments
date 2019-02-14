# webuilder-docblockcomments v1.33
Plugin for Blumentals WeBuilder/RapidPHP/RapidCSS/HTMLPad editors

This is a plugin for the following editors:

Webuilder: http://www.webuilderapp.com/<br/>
RapidPHP: http://www.rapidphpeditor.com/<br/>
RapidCSS: https://www.rapidcsseditor.com/<br/>
HTMLPad: https://www.htmlpad.net/


#### Function:
An editor plugin for PHP and JavaScript coders, that helps you comment your code.

**How it works:**
When the trigger key combination is pressed in the editor, the plugin will analyze the next line of your script.
If the line contains a 'function' or 'var' definition it will insert a DocBlock Comment block in the editor. (Plugin can also be configured to insert a simple DocBlock Comment regardless if next line contains a 'function', 'var' or not.)

One of the benefits of "DocBlock Comments", is that it makes it so much easier to compile documentation later using programs like phpDocumentor

[![Example Screencapture video](http://img.youtube.com/vi/8rZ4rABRcgk/0.jpg)](http://www.youtube.com/watch?v=8rZ4rABRcgk)


**Menu-based features:**

 * **Insert Page DocBlock Comment** - Inserts a special Page DocBlock Comment just below the scripting tag. (<?php or <script)
 * **Insert DocBlock Comment** - Inserts a DocBlock Comment. (Similar to pressing the trigger combination in the editor.)
 * **Process entire document** - Loops through the entire document and adds DocBlock Comments for all functions and var statements.
 * **Update function index** - Updates the "Function Index" of Page DocBlock Comments, Creating a list of all functions and their corresponding linenumber in the script.
 * **Goto to function from index** - Will jump to the line listed in the Function Index if cursor is placed on line in the Function Index.


#### Installation:
1) Download plugin .ZIP file.
2) Open editor and select "Plugins -> Manage Plugins" from the menu.
3) Click "Install" and select the .ZIP file you downloaded in step 1.
