/**
 * An editor plugin for PHP and JavaScript coders, that helps you comment your code.
 *
 * When the trigger key combination is pressed in the editor, the plugin will analyze the next line of your script.
 * If the line contains a 'function' or 'var' definition, it will insert a DocBlock Comment block in the editor.
 *
 * @category  WeBuilder Plugin
 * @package   DocBlock Comments
 * @author    Peter Klein <pmk@io.dk>
 * @copyright 2016 Peter Klein
 * @license   http://www.freebsd.org/copyright/license.html  BSD License
 * @version   1.33
 */

/**
 * [CLASS/FUNCTION INDEX of SCRIPT]
 *
 *     82   function Split(str, splitChar)
 *    105   function RemoveQuoted(str)
 *    116   function RemoveSquareBrackets(str)
 *    128   function RemoveVarTrailing(str)
 *    140   function RemoveFuncTrailing(str)
 *    152   function RemoveFuncLeading(str)
 *    164   function RewriteJavaScriptFunctions(str)
 *    176   function Debug(label, val)
 *    189   function renderFunction(line, type, indent)
 *    278   function renderVar(line, type, indent)
 *    308   function renderClass(line, type, indent)
 *    333   function renderDefine(line, type, indent)
 *    359   function renderSimple(line, type, indent)
 *    374   function renderPageBlock(beforeLine, afterLine, indent)
 *    407   function InsertCommentInEditor(startLine, commentBlock)
 *    438   function UpdateFunctionIndex(sender)
 *    545   function GotoToFunctionIndex()
 *    570   function ProcessDocument(sender)
 *    599   function FindLanguageTag(sender)
 *    638   function InsertComment(sender)
 *    649   function AnalyzeEditorLine(key)
 *    719   function ShowPluginInfo(sender)
 *    819   function OnBeforeSave(doc)
 *    850   function InsideBlockComment(key)
 *    897   function ClearKeyCombo()
 *    909   function OnKeypress(key)
 *    931   function OnDoubleClick(Sender)
 *    966   function makeDoubleClickSelection()
 *    979   function OnInstalled()
 *
 * TOTAL FUNCTIONS: 29
 * (This index is automatically created/updated by the WeBuilder plugin "DocBlock Comments")
 *
 */

var triggerCombo		= Script.ReadSetting("Trigger sequence", "/**"),	// The keyboard character sequence that triggers the plugin
    triggerComboLength 	= Length(triggerCombo),				// Length of keyboard combo
	keyCombo            = triggerCombo,					    // Storage of keyboard sequence pressed
	triggerKeywordsOnly	= Script.ReadSetting("Trigger on keywords only", "1"),
	returnValueDesc		= Script.ReadSetting("Add default description to return value", "1"),
	returnValueVars		= Script.ReadSetting("Add default description to var names", "1"),
	timer = null,
	legalCodeTypes		= [ltPHP, ltJScript],				// Document/code types where the plugin is active
	regExTypes			= "^(function|define|class|interface|include_once|include|require_once|require|abstract|var|public|private|protected)",	// type of words that triggers the DocBlock Comments
	regExFtype			= "(abstract|static)",
	regExVisibility		= "(public|private|protected)",
	//regExFunction		= "function(?:.*)\\((.*)\\)",		// RegEx for extracting function parameters
    regExFunction       = "function(?:[^\\(]*\\()(.*)(?:\\))$",
	regExVar			= "\\s*(.*)",				 		// RegEx for extracting variable name
	regExDefine			= "define(?:.*)\\(([^,]*).*\\)",	// RegEx for extracting define name
	defAuthorName		= Script.ReadSetting("Default Author Name text", "[add AuthorName]"),
	defAuthorEmail		= Script.ReadSetting("Default Author Email text", "[add AuthorEmail]"),
	defLicenseUrl		= Script.ReadSetting("Default License Url text", "[add LicenseUrl]"),
	defVersionNumber	= Script.ReadSetting("Default Version Number text", "[add VersionNumber]"),
	defType				= Script.ReadSetting("Default type text", "[add type]"),
	defDesc				= Script.ReadSetting("Default description text", "[add description]");

/**
 * Helper function: Split string.
 *
 * @param  string  str: The string to split
 * @param  string  splitChar: The character to split at
 * @return array
 */
function Split(str, splitChar) {
	var res[0],
		count = 0,
		val = str + splitChar,
	   	p = Pos(splitChar,val);
	while (p > 0) {
		arg = Trim(Copy(val, 1, p - 1));
		DeleteStr(val, 1, p)
	 	SetLength(res,count + 1);	// Increase array size
		res[count] = arg;
		count++;
		p = Pos(splitChar, val);
	}
	return res;
}

/**
 * Helper function: Get rid of quoues and anything between them.
 *
 * @param  string  str: the string to clean
 *
 * @return string
 */
function RemoveQuoted(str) {
    return RegexReplace(str,"(?:\"[^\"]*\")|(?:'[^']*')", "", true);
}

/**
 * Helper function: Get rid of square brackets and anything between them.
 *
 * @param  string   str: the string to clean
 *
 * @return string
 */
function RemoveSquareBrackets(str) {
	return RegexReplace(str, "\\[.*\\]", "", true);
}

/**
 * Helper function: remove commas (multi assignments), semicolon, equal, comments and anything after
 * Used for cleaning up "var" lines.
 *
 * @param  string     str: the string to clean
 *
 * @return string
 */
function RemoveVarTrailing(str) {
	return RegexReplace(str, "\\s*([,;=]|(\\/(\\/)|(\\/\\*))).*$", "", true);
}

/**
 * Helper function: remove semicolon, starting brackets, comments and anything after
 * Used for cleaning up "function" lines.
 *
 * @param      string     str: the string to clean
 *
 * @return string
 */
function RemoveFuncTrailing(str) {
	return RegexReplace(str, "\\s*(;|:|\\{|\\/\\/|\\/\\*).*$", "", true);
}

/**
 * Helper function: Remove any leading keywords
 * Used for cleaning up "function" lines.
 *
 * @param      string     str: the string to clean
 *
 * @return string
 */
function RemoveFuncLeading(str) {
    return Trim(RegexReplace(str, "(public|private|protected|abstract|static|var)(?=.*function)", "", true));
}

/**
 * Helper function: Rewrite javascript functions in format:
 * "functionName=function()" into "function functionName()"
 *
 * @param      string     str: the string to clean
 *
 * @return string
 */
function RewriteJavaScriptFunctions(str) {
	return RegexReplace(str, "^\\s*(var\\s)?([^=\\s]*)(\\s*=\\s*)(function)\\(", "$4 $2(", true);
}

/**
 * Debug helper
 *
 * @param  string    label: the label
 * @param  mixed     val: the variable
 *
 * @return void
 */
function Debug(label, val) {
	Script.Message(label + ": " + _t(val));
}

/**
 * Render DocBlock Comment for "Function" type.
 *
 * @param      string     line: The line with the Function definition
 * @param      string     type: The type of match
 * @param      string     indent: The indentation of the comment block
 *
 * @return string
 */
function renderFunction(line, type, indent) {
	var desc, tmp, argument, hint, out = "", extra ="";
	if (RegexMatchAll(line, regExFunction, true, matches, poses) == true) {
		if (Length(matches)) {
			// Get the function arguments
			var args = Split(_v(matches, [0, 1]), ",");
			var l = Length(args);
			if (args[0] != "") {
				out = indent + " * \n";
	            for (var i=0;i<l;i++) {
					desc = "";
					switch(Document.CurrentCodeType) {
						case ltPHP: {
							// PHP functions can contain optional hints before the variable name
							tmp = Split(args[i], " ");
							if ((Length(tmp) > 1) && (tmp[1] != "=")) {
								argument = tmp[1];
								hint = tmp[0];
							}
							else {
								argument = args[i];
								hint = defType;
							}
							// PHP function arguments can contain an optional default value,
							// so we need to get rid of that if present.
							if (RegexMatch(argument, "=", true) != "") {
								tmp = Split(argument, "=");
								argument = Trim(tmp[0]);
								desc += " (Optional) ";
							}
							// PHP function arguments can be passed by reference,
							// so we need to get rid of the "&" sign if present.
							if (RegexMatch(argument, "^&", true) != "") {
								argument = RegexReplace(argument, "^&", "", true);
								desc += " (Passed by reference)";
							}

						}
						default: {
							// Javascript
							argument = args[i];
							hint = defType;
						}
					}
					if (Length(hint)< 12) hint = Format("%-12s", [hint]);
					if ((desc == "")  && (returnValueVars == "1")) desc = " " + defDesc;
					out += indent + " * @param  " + hint + " " + argument + desc + "\n";
				}
			}
			if (returnValueDesc == "1") desc = "  " + defDesc;
			else desc = "";

			// Extra stuff

			// Remove function part
			line = RegexReplace(line, "function.*$", "", true);

			// Add @access: public, private or protected if matched;
			var visibility = RegexMatch(Trim(line), regExVisibility, true);
			if(visibility != "") extra += indent + " * @access " + visibility + "\n";

			// Add @abstract or @static if matched;
			var ftype = RegexMatch(Trim(line), regExFtype, true);
			if (ftype != "") extra += indent + " * @" + ftype + "\n";

			// Add empty line above extra stuff
			if (extra != "") extra = indent + " * \n" + extra;

			return "\n" +
			        indent + "/**\n" +
					indent + " * " + defDesc + "\n" +
					out +
					indent + " * \n" +
					indent + " * @return " + defType + desc + "\n" +
					extra +
					indent + " */\n";
		}
	}
}

/**
 * Render DocBlock Comment for "Var" type.
 *
 * @param      string     line: The line with the Var definition
 * @param      string     type: The type of match
 * @param      string     indent: The indentation of the comment block
 *
 * @return string
 */
function renderVar(line, type, indent) {
	var out = "";
	if (RegexMatchAll(line, type + regExVar, true, matches, poses) == true) {
		if (Length(matches)) {
			var varName = Trim(_v(matches, [0, 1]));	// Get the variable name;
			if (returnValueVars == "1") varName += " " + defDesc;
			out = indent + " * @var " + varName + "\n";
			if (type != "var") {
				// If it's not a "var" then it's a PHP visibility
				out += indent + " * \n" + indent + " * @access " + type + "\n";
			}
			return "\n" +
					indent + "/**\n" +
					indent + " * " + defDesc + "\n" +
					indent + " * \n" +
					out +
					indent + " */\n";
		}
	}
}

/**
 * Render DocBlock Comment for "Class, Interface & Abstract" types.
 *
 * @param      string     line: The line with the Var definition
 * @param      string     type: The type of match
 * @param      string     indent: The indentation of the comment block
 *
 * @return string
 */
function renderClass(line, type, indent) {
	var out = "";
	if (RegexMatchAll(line, type + regExVar, true, matches, poses) == true) {
		if (Length(matches)) {
			out = "\n" +
			indent + "/**\n" +
			indent + " * " + defDesc + "\n" +
			indent + " * \n" +
			indent + " * @author    " + defAuthorName + " <" + defAuthorEmail + ">\n" +
			indent + " * @package   [add PackageName]\n" +
			indent + " */\n";
		}
	}
	return out;
}

/**
 * Render DocBlock Comment for "Define" type.
 *
 * @param      string     line: The line with the Var definition
 * @param      string     type: The type of match
 * @param      string     indent: The indentation of the comment block
 *
 * @return string
 */
function renderDefine(line, type, indent) {
	var out = "";
	if (RegexMatchAll(line, regExDefine, true, matches, poses) == true) {
		if (Length(matches)) {
			var varName = Trim(_v(matches, [0, 1]));	// Get the variable name;
			if (returnValueVars == "1") varName += " " + defDesc;
			out = indent + " * @name " + varName + "\n";
			return "\n" +
					indent + "/**\n" +
					indent + " * " + defDesc + "\n" +
					indent + " * \n" +
					out +
					indent + " */\n";
		}
	}
}

/**
 * Render Simple DocBlock Comment type.
 *
 * @param      string     line: The line with the definition
 * @param      string     type: The type of match
 * @param      string     indent: The indentation of the comment block
 *
 * @return string
 */
function renderSimple(line, type, indent) {
	return "\n" +
			indent + "/**\n" +
			indent + " * " + defDesc + "\n" +
			indent + " */\n";
}

/**
 * Render Page DocBlock Comment type.
 *
 * @param      string     line: The line with the definition
 * @param      string     indent: The indentation of the comment block
 *
 * @return string
 */
function renderPageBlock(beforeLine, afterLine, indent) {
	return beforeLine +
			indent + "/**\n" +
			indent + " * " + defDesc + "\n" +
			indent + " * \n" +
			indent + " * [add longDescription]\n" +
			indent + " * \n" +
			indent + " * @category  [add CategoryName]\n" +
			indent + " * @package   [add PackageName]\n" +
			indent + " * @author    " + defAuthorName + " <" + defAuthorEmail + ">\n" +
			indent + " * @copyright " + FormatDateTime("yyyy",Date) + "\n" +
			indent + " * @license   " + defLicenseUrl + "\n" +
			indent + " * @version   " + defVersionNumber + "\n" +
			indent + " */\n" +
			// Special block for Function Index
  			indent + "\n/**\n" +
			indent + " * [CLASS/FUNCTION INDEX of SCRIPT]\n" +
			indent + " * \n" +
			indent + " * TOTAL FUNCTIONS: -\n" +
			indent + " * (This index is automatically created/updated by the plugin \"DocBlock Comments\")\n" +
			indent + " * \n" +
			indent + " */\n" +
			afterLine;
}

/**
 * Inserts comment block into editor.
 *
 * @param int       startLine The line to insert comment on
 * @param  string   commentBlock	The comment block
 *
 * @return void
 */
function InsertCommentInEditor(startLine, commentBlock) {
	var uSel = Editor.Selection;

	Editor.BeginEditing;

	// Insert DocBlock Comment
	uSel.SelStartLine = startLine;
	uSel.SelStartCol = 0;
	uSel.SelEndLine = startLine + 1;
	uSel.SelEndCol = 0;
	Editor.Selection = uSel;
	Editor.SelText = commentBlock;

	// Move selection to the description block at the 2nd line
	var defDescPos = Pos(defDesc, Editor.LinesAsDisplayed[startLine + 2]) - 1;
	uSel.SelStartLine = startLine + 2;
	uSel.SelStartCol = defDescPos;
	uSel.SelEndLine = startLine + 2;
	uSel.SelEndCol = defDescPos + Length(defDesc);
	Editor.Selection = uSel;

	Editor.EndEditing;
}

/**
 * Update function index of Page Docblock Comment
 *
 * @param Tobject  sender
 *
 * @return void
 */
function UpdateFunctionIndex(sender) {
	var uSel = Editor.Selection,
		func = "",
		indent = "",
		out = "",
		currentLineNum = 0,
		functionCount = 0,
		classCount = 0,
		startLine = -1,
		endLine = -1;

    for (currentLineNum = 0; currentLineNum < Editor.LineCount; currentLineNum++) {
		if (regexMatch(Trim(Editor.Lines[currentLineNum]), "^\\* \\[CLASS\\/FUNCTION INDEX of SCRIPT\\]", true) != "") {
			startLine = currentLineNum - 1;
			indent = RegexMatch(Editor.Lines[startLine], "^\\s*", false);	// Grab indentation from line (Don't care if it's spaces or tabs)
			break;
		}
	}

	if (startLine == -1) {
		if (sender != null) Alert("No Function Index found!\n\nInsert a Page DocBlock Comment and run this command again.");
		return;
	}

    for (currentLineNum = startLine + 1; currentLineNum < Editor.LineCount; currentLineNum++) {
		if (regexMatch(Trim(Editor.Lines[currentLineNum]), "^\\*\\/", true) != "") {
			endLine = currentLineNum + 1;
			break;
		}
	}
	if (endLine == -1) {
		if (sender != null) Alert("No Function Index terminator found!");
		return;
	}

	var	functionIndex = [1],
			lineNumIndex = [1],
			offset = endline - startLine;

    for (currentLineNum = 0; currentLineNum < Editor.LineCount; currentLineNum++) {

		/*
		Function (Class/Interface) Cleanup sequence:
		1) Remove Quoted
		2) Rewrite Javascript func
		3) Remove func trailing
		4) Remove func leading
		*/
		var currentLine = Editor.Lines[currentLineNum];
		currentLine = RemoveQuoted(currentLine);
		currentLine = RewriteJavaScriptFunctions(currentLine);
		currentLine = RemoveFuncTrailing(currentLine);
		currentLine = RemoveFuncLeading(currentLine);
		// Debug("line",currentLine);

		// Test if keyword is present
		if (RegexMatch(currentLine, "^((function\\s*\\w+\\()|(class\\s+[^{]*))", true) != "") {
		//if (RegexMatch(currentLine, "^function\\s*\\w+\\(", true) != "") {
			// Can't figure out how to do multi dimensional arrays, as the Length() function only accepts 2 parameters
			// So I'll have to use 2 single dimensional arrays instead. :(
		 	SetLength(lineNumIndex, functionCount + 1);	// Increase array size
			lineNumIndex[functionCount] = currentLineNum;
		 	SetLength(functionIndex, functionCount + 1);	// Increase array size
			functionIndex[functionCount] = currentLine;
			functionCount++;
		}
	}

	if (functionCount > 0) {
	  for (var i = 0; i < functionCount; i++) {
	  	var functionIndent = "   ";
			if (regexMatch(functionIndex[i], "^class\\s+", true) != "") {
				classCount++;
				functionIndent = " ";
			}
			out += indent + " * " + Format("%6d", [lineNumIndex[i] + functionCount - offset + 9]) + functionIndent + functionIndex[i] + "\n";
		}
		out = indent + "/**\n" +
				indent + " * [CLASS/FUNCTION INDEX of SCRIPT]\n" +
				indent + " * \n" +
				out +
				indent + " * \n" +
				indent + " * TOTAL FUNCTIONS: " + _t(functionCount - classCount) + "\n" +
				indent + " * (This index is automatically created/updated by the WeBuilder plugin \"DocBlock Comments\")\n" +
				indent + " * \n" +
				indent + " */\n";

		Editor.BeginEditing;

		// Insert DocBlock Function Index
		uSel.SelStartLine = startLine;
		uSel.SelStartCol = 0;
		uSel.SelEndLine = endLine;
		uSel.SelEndCol = 0;
		Editor.Selection = uSel;
		Editor.SelText = out;

		Editor.EndEditing;
	}

}

/**
 * Goto the function cursor is on in the Function index
 *
 * @return void
 */
function GotoToFunctionIndex() {
    // Test if line is part of the Function index. (just checks if the line matches the format)
    if (RegexMatchAll(Editor.Lines[Editor.Selection.SelStartLine], "\\s*\\*\\s*(\\d+)\\s{3}(?:function|class)\\s", true, match, p) == true) {
        var lineNum = StrToInt(_v(match, [0, 1]));
        if (lineNum > 0) {
            var Sel = Editor.Selection;
            Sel.SelStartLine = lineNum - 1;
            Sel.SelStartCol = 0;
            Sel.SelEndLine = lineNum - 1;
            Sel.SelEndCol = 0;
            Editor.Selection = Sel;
        }
    }
    else {
        Alert("Cursor must be on a line in the function index!");
    }
}

/**
 * Loop through entire document and add DocBlock Comments.
 *
 * @param Tobject  sender
 *
 * @return void
 */
function ProcessDocument(sender) {
	var uSel = Editor.Selection,
		triggerKeywordsOnlySaved = triggerKeywordsOnly; // Save original triggerKeywordsOnly settings

	triggerKeywordsOnly = "1";	// Force triggerKeywordsOnly mode

	FindLanguageTag(sender);

    for (var lineCount = 0; lineCount < Editor.LineCount; lineCount++) {
		if ( (Length(Trim(Editor.Lines[lineCount])) == 0) ) {
			uSel.SelStartLine = lineCount;
			uSel.SelStartCol = 0;
			uSel.SelEndLine = lineCount + 1;
			uSel.SelEndCol = 0;
			Editor.Selection = uSel;
			AnalyzeEditorLine("");
		}
	}
	// Restore original triggerKeywordsOnly settings
	triggerKeywordsOnly = triggerKeywordsOnlySaved;
}

/**
 * Find scripting language tag "<?php" or "<script" and insert Page DocBlock Comment below
 *
 * @param Tobject  sender
 *
 * @return void
 */
function FindLanguageTag(sender) {
	var userSelection = Editor.Selection,
		startLine = userSelection.SelStartLine,
		match = false;
	if ((startLine >= 0) && (userSelection.SelEndLine >= 0)) {
 		for (var lineCount = startLine - 1; lineCount >= 0; lineCount--) {
			var currentLine = Trim(Editor.Lines[lineCount]);
			if (RegexMatch(currentLine, "^<(\\?php|script)", true) != "") {
				// Found the programming language tag
				var indent = RegexMatch(Editor.Lines[lineCount], "^\\s*", false);	// Grab indentation from line (Don't care if it's spaces or tabs)
				match = true;
				if (Trim(Editor.Lines[lineCount + 1]) == "/**") {
					Alert("Warning. Existing Page DocBlock Comment already present!");
				}
				else {
					// Insert Page DocBlock Comment
					InsertCommentInEditor(lineCount, renderPageBlock(currentLine + "\n", "", indent));
				}
				break;
			}
		}
		if (!match) {
			if (Trim(Editor.Lines[0]) == "/**") {
				Alert("Warning. Existing Page DocBlock Comment already present!");
			}
			else if (Confirm("No matching language tag found above cursor position!\nAdd Page DocBlock Comment in top of document?")) {
				InsertCommentInEditor(0, renderPageBlock("", Editor.Lines[0] + "\n", ""));
			}
		}
	}
}

/**
 * Add DocBlock Comment when selected from menu.
 *
 * @param Tobject  sender
 *
 * @return void
 */
function InsertComment(sender) {
	AnalyzeEditorLine("");
}

/**
 * Analyzes the line below the cursor to see if a comment should be inserted.
 *
 * @param  string     key: The key presssed in the editor
 *
 * @return string     chr(0) if comment is inserted, otherwise the key pressed
 */
function AnalyzeEditorLine(key) {
	var userSelection = Editor.Selection;
	var startLine = userSelection.SelStartLine;

	if (
		(startLine >= 0) && (userSelection.SelEndLine >= 0) && (((key == "") && (Trim(Editor.Lines[startLine]) == "")) || ((Trim(Editor.Lines[startLine]) == Copy(triggerCombo, 1, triggerComboLength-1))))) {
    var line = Editor.Lines[startLine + 1]; 	// Line below cursor
		var indent = RegexMatch(line, "^\\s*", false);	// Grab indentation from line (Don't care if it's spaces or tabs)
		line = Trim(line);

		// Does the next line contain a keyword type we accept?
		var type = RegexMatch(line, regExTypes, true);

		if ((type != "") || (triggerKeywordsOnly != "1") ) {

			line = RemoveQuoted(line);					// Remove stuff enclosed in quotes
			line = RemoveSquareBrackets(line);			// Remove stuff enclosed in square brackets
			line = RewriteJavaScriptFunctions(line);    // Normalize JavaScript functon formats

			if (RegexMatch(RemoveFuncLeading(RemoveFuncTrailing(line)), "^function\\s*\\w+\\s*\\(", true) != "") {
    			// Remove trailing function stuff
				commentBlock = renderFunction(RemoveFuncTrailing(line), type, indent);
			}
			else {
				line = RemoveVarTrailing(line);				// Remove trailing 'var' stuff
				//debug("varLine",line);
				switch(type) {
					case "var":				commentBlock = renderVar(line, type, indent);
					case "public":			commentBlock = renderVar(line, type, indent);
					case "private":			commentBlock = renderVar(line, type, indent);
					case "protected":		commentBlock = renderVar(line, type, indent);
					case "define":			commentBlock = renderDefine(line, type, indent);
					case "class":		 	commentBlock = renderClass(line, type, indent);
					case "interface":		commentBlock = renderClass(line, type, indent);
					case "abstract":		commentBlock = renderClass(line, type, indent);
					case "include":			commentBlock = renderSimple(line, type, indent);
					case "include_once": 	commentBlock = renderSimple(line, type, indent);
					case "require":			commentBlock = renderSimple(line, type, indent);
					case "require_once": 	commentBlock = renderSimple(line, type, indent);
					default: {
						if (triggerKeywordsOnly == "1") return key;
						else commentBlock = renderSimple(line, type, indent);
					}
				}
			}

			// Undo the previously entered triggerCombo characters if not selected from menu
			if(key != "") {
				for (var i=1;i<triggerComboLength;i++){
					Actions.Execute("ActUndo");
				}
			}

			// Insert DocBlock Comment
	   	    InsertCommentInEditor(startLine, indent + commentBlock);

			return chr(0);	// Prevent key pressed from being returned to the editor.
		}
		return key;
	}
	return key;
}

/**
 * Show plugin info if selected from menu.
 *
 * @param Tobject  sender
 *
 * @return void
 */
function ShowPluginInfo(sender) {
	var hMargin = 16,
		vMargin = 14,
		viewHeight = 500,
		viewWidth = 700,
		borderWidth = 2,
		buttonHeight = 25;

    var modalForm = new TForm(WeBuilder);
    modalForm.Width = viewWidth + (hMargin * 2) + borderWidth;
    modalForm.Height = viewHeight + (vMargin * 3) + buttonHeight + 32 + borderWidth;
    modalForm.Color = clMenu;
    modalForm.Position = poScreenCenter;
    modalForm.BorderStyle = bsSingle; 		// disable dialog resizing
    modalForm.BorderIcons = biSystemMenu; // remove maximize & minimize buttons
    modalForm.AlignWithMargins = true;
    modalForm.Font.Color = clWindowText;
    modalForm.Font.Height = -12;
    modalForm.Font.Name = "Tahoma";
    modalForm.Caption = "DocBlock Comments Info";

	// PageControl object
	var pctObj = new TPageControl(modalForm);
	pctObj.Parent = modalForm;
	pctObj.AlignWithMargins = true;
	pctObj.SetBounds(hMargin, vMargin, viewWidth, viewHeight);

    // 1st TabSheet
	var tabSheet1 = new TTabSheet(pctObj);
	tabSheet1.Parent = pctObj;
	tabSheet1.PageControl = pctObj;
	tabSheet1.Caption = "Plugin Usage";

	// 1st TPanel object
 	var pnlWrapper1 = new TPanel(tabSheet1);
	pnlWrapper1.Parent = tabSheet1;
	pnlWrapper1.BorderStyle = bsNone;
	pnlWrapper1.Color = clWhite;
	pnlWrapper1.ParentBackground = false;
	pnlWrapper1.SetBounds(0, 0, viewWidth, viewHeight);

	// 1st RichText object
 	var rteObj1 = new TRichEdit(tabSheet1);
	rteObj1.Parent = pnlWrapper1;
	rteObj1.Color = clWhite;
	rteObj1.BorderStyle = bsNone;
	rteObj1.Align = alNone;
	rteObj1.AlignWithMargins = true;
	rteObj1.ScrollBars = ssVertical;
	rteObj1.ReadOnly = true;
	rteObj1.Lines.LoadFromFile(Script.Path + "/docs/usage.rtf");
	rteObj1.SetBounds(0, 0, viewWidth - 7, viewHeight - 32);

    // 2nd TabSheet
	var tabSheet2 = new TTabSheet(pctObj);
	tabSheet2.Parent = pctObj;
	tabSheet2.PageControl = pctObj;
	tabSheet2.Caption = "DocBlocks Info";

	// 2nd TPanel object
 	var pnlWrapper2 = new TPanel(tabSheet2);
	pnlWrapper2.Parent = tabSheet2;
	pnlWrapper2.BorderStyle = bsNone;
	pnlWrapper2.Color = clWhite;
	pnlWrapper2.ParentBackground = false;
	pnlWrapper2.AlignWithMargins = true;
	pnlWrapper2.SetBounds(0, 0, viewWidth, viewHeight);

	// 2nd RichText object
 	var rteObj2 = new TRichEdit(tabSheet2);
	rteObj2.Parent = pnlWrapper2;
	rteObj2.Color = clWhite;
	rteObj2.BorderStyle = bsNone;
	rteObj2.Align = alNone;
	rteObj2.AlignWithMargins = true;
	rteObj2.ScrollBars = ssVertical;
	rteObj2.ReadOnly = true;
	rteObj2.Lines.LoadFromFile(Script.Path + "/docs/docblocks.rtf");
	rteObj2.SetBounds(0, 0, viewWidth - 7, viewHeight - 32);

	// OK button object
    var btnOk = new TButton(modalForm);
    btnOK.Parent = modalForm;
    btnOk.Caption = "Close";
    btnOk.Default = True;
    btnOK.ModalResult = mrCancel;
    btnOK.SetBounds(modalForm.Width - 75 - hMargin - borderWidth, viewHeight + (vMargin * 2), 75, 25);

	modalForm.ShowModal;
	delete modalForm; // Remove Modal object
}

/**
 * OnBeforeSave event handler
 * Runs the UpdateFunctionIndex before saving HTML, JavaScript or PHP files
 *
 * @param  TDocument  doc: Document object
 *
 * @return void
 */
function OnBeforeSave(doc) {
	if ((doc.DocType in [dtHTML, dtJScript, dtPHP]) && (Editor.Modified)) {

		// Save selection/scroll position
		var sel = Editor.Selection,
			topLine = Editor.TopLine,
			startLine = sel.SelStartLine,
			startCol = sel.SelStartColReal,
			endLine = sel.SelEndLine,
			endCol = sel.SelEndColReal;

		// Update function index
		UpdateFunctionIndex(null);

		// Restore selection/scroll position
		sel.SelStartLine = startLine;
		sel.SelStartColReal = startCol;
		sel.SelEndLine = endLine;
		sel.SelEndColReal = endCol;
		Editor.Selection = sel;
		Editor.TopLine = topLine;
	}
}

/**
 * Adds DocBlock start code if inside a DocBlock Comment when pressing enter.
 *
 * @param  string     key: The key presssed in the editor
 *
 * @return string     chr(0) if comment is inserted, otherwise the key pressed
 */
function InsideBlockComment(key) {
	var sel = Editor.Selection,
		startLine = sel.SelStartLine;

	if (startLine > 0) {
		var line = Editor.Lines[startLine - 1];
		var match = RegexMatch(line, "^(\\s+\\*([^\\/]|$))|(\\s*\\/\\*\\*$)", true);
		if (match != "") {
			var indent = RegexMatch(line, "^\\s*", false);	// Grab indentation
			if (Trim(match) == "/**") indent += " ";

			Editor.BeginEditing;

            var uSel = Editor.Selection;

            // update new line
			uSel.SelStartLine = startLine;
			uSel.SelStartColReal = 0;
			uSel.SelEndLine = startLine;
			uSel.SelEndColReal = uSel.SelStartColReal;
			Editor.Selection = uSel;
            Editor.SelText = indent + "*";

            // unselect and place cursor
            uSel.SelStartLine = startLine;
			uSel.SelStartColReal = Length(indent + "*") + 1;
			uSel.SelEndLine = startLine;
			uSel.SelEndColReal = uSel.SelStartColReal;
            Editor.Selection = uSel;

			Editor.EndEditing;

			// This have to be here to get undo to correcly undo the action above. No clue why.
			//Actions.Execute("ActUndo");

			key = chr(0);
		}
	}
	return key;
}

/**
 * OnTimer event handler
 * Clear the KeyCombo variable after a certain time
 *
 * @return void
 */
function ClearKeyCombo() {
	timer = null;
	keyCombo = triggerCombo;
}

/**
 * OnKeypress event handler
 * Detects if valid key combination is entered in the editor.
 *
 * @param  string  key: The character key pressed
 * @return void
 */
function OnKeypress(key) {

	if (Document.CurrentCodeType in legalCodeTypes) {
		if (timer != null) timer.Kill;
		timer = Script.TimeOut(1000, "ClearKeyCombo");

		keyCombo = Copy(keyCombo + key, 2, triggerComboLength );
		if (keyCombo == triggerCombo) {
			key = AnalyzeEditorLine(key);
		}
		else if (key == chr(13)) {
			key = InsideBlockComment(key);
		}
	}
}

/**
 * OnDoubleClick event handler
 * Makes selection of complete defaut label incl. square brackets when doubleclicking
 *
 * @return void
 */
function OnDoubleClick(Sender) {
    var Sel = Editor.Selection,
		startLine = Sel.SelStartLine;

	if (startLine > 0) {
		var line = Editor.Lines[startLine];

        // Is this a comment line with a default label?
		if (RegexMatch(line, "^\\s+\\*\\s*[^\\]]*\\[[^\\]]*\\]", true) != "") {
            var linePos = Editor.Selection.SelStartColReal;
            var leftContent = Copy(line, 0, linePos);
            // Test if we can find a square starting bracket at the left side of the cursor position
            if (RegexMatchAll(leftContent, ".*(?=\\\[[^\\\[]*)", true, match, p) == true) {

                startPos = Length(_v(match, [0, 0]));

                // Test if we can find the a square closing bracket at the right side of the cursor position
                if (RegexMatchAll(Copy(line, linePos + 1, Length(line)), "[^\\\]]*(\\\])", true, match, p) == true) {
                    endPos = Length(leftContent) + _v(p, [0, 1]);

                    // It's not possible to set the selection at this point, due to build in doubleclick selection
                    // So we need to make the selection in a separate process
                    Script.TimeOut(10, "makeDoubleClickSelection");

                }
            }
        }
    }
}

/**
 * Process for selecting the default label when doubleclicking
 *
 * @return void
 */
function makeDoubleClickSelection() {
    // Make selection
    Sel = Editor.Selection;
    Sel.SelStartColReal = startPos;
    Sel.SelEndColReal = endPos;
    Editor.Selection = Sel;
}

/**
 * Show info when plugin is installed
 *
 * @return void
 */
function OnInstalled() {
  alert("DocBlock Comments 1.33 by Peter Klein installed sucessfully!");
}

var bmp = new TBitmap, act;

Script.ConnectSignal("keypress", "OnKeypress");
Script.ConnectSignal("installed", "OnInstalled");
Script.ConnectSignal("document_before_save", "OnBeforeSave");
Script.ConnectSignal("double_click", "OnDoubleClick");

act = Script.RegisterDocumentAction("DocBlock Comments", "Insert Page DocBlock Comment", "", "FindLanguageTag");
LoadFileToBitmap(Script.Path + "icons/insert_page_docblock.png", bmp);
Actions.SetIcon(act, bmp);

act = Script.RegisterDocumentAction("DocBlock Comments", "Insert DocBlock Comment", "", "InsertComment");
LoadFileToBitmap(Script.Path + "icons/comment.png", bmp);
Actions.SetIcon(act, bmp);

act = Script.RegisterDocumentAction("DocBlock Comments", "Process entire document", "", "ProcessDocument");
LoadFileToBitmap(Script.Path + "icons/process_document.png", bmp);
Actions.SetIcon(act, bmp);

act = Script.RegisterDocumentAction("DocBlock Comments", "Update function index", "", "UpdateFunctionIndex");
LoadFileToBitmap(Script.Path + "icons/update.png", bmp);
Actions.SetIcon(act, bmp);

act = Script.RegisterDocumentAction("DocBlock Comments", "Goto to function from index", "", "GotoToFunctionIndex");
LoadFileToBitmap(Script.Path + "icons/goto.png", bmp);
Actions.SetIcon(act, bmp);

act = Script.RegisterAction("DocBlock Comments", "Show Help", "", "ShowPluginInfo");
LoadFileToBitmap(Script.Path + "icons/help.png", bmp);
Actions.SetIcon(act, bmp);

delete bmp;
