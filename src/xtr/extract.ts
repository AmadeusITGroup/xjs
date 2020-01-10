import { XtrParamHost, XtrParamDictionary, XtrPreProcessorCtxt, XtrElement, XtrFragment, addText, addElement, addParam, XtrText } from './ast';
import { join, isAbsolute } from 'path';
import { promises } from 'fs';
import { IToken } from 'vscode-textmate';
import { tokenize } from '../xjs/tm-parser';

const U = undefined,
    RX_CR = /\n/,
    RX_FILE_NAME = /[^\/]+$/,
    RX_SECTION_DEF = /^\s*\/\/\s*@@extract\:\s*(\w[\w\$\-]*)( .*)?$/,
    RX_SECTION_NAME = /^\w[\w\$\-]*$/,
    RX_FILE_EXT = /\.([^\.]+)$/,
    RX_EMPTY_LINE = /^\s*$/,
    STR_NBSP = '\u00A0'; // non-breaking space

interface Section {
    lineIdx: number;    // index of first line
    nbrOfLines: number;
}

interface SectionDict {
    lines: string[];
    tokens?: IToken[][];
    sections: Section[];
}

export function extract() {
    const cache: { [path: string]: SectionDict } = {};

    return {
        async process(target: XtrParamHost, params: XtrParamDictionary, ctxt: XtrPreProcessorCtxt) {
            const value = params.value;
            let sectionDict: SectionDict, sectionName = "", fileExtension = "";

            if (value === U) {
                return ctxt.error("Invalid usage: file path must be provided");
            }

            // determine target file path
            let relPath = value.value as string, idx = relPath.indexOf('#');
            if (idx < 0) {
                return ctxt.error("Invalid file path: no section name provided", value.pos);
            }
            sectionName = relPath.slice(idx + 1);
            relPath = relPath.slice(0, idx);
            if (relPath.match(RX_FILE_EXT)) {
                fileExtension = RegExp.$1;
            }

            sectionDict = cache[relPath];
            if (sectionDict === U) {
                cache[relPath] = sectionDict = { lines: [], sections: [] };

                if (relPath.charAt(0) === "/") {
                    ctxt.error("Invalid path: file path must be relative", value.pos);
                }

                let p = join(ctxt.fileId.replace(RX_FILE_NAME, ""), relPath);
                let fileContent = "";

                if (!isAbsolute(p)) {
                    p = join(__dirname, p);
                }

                try {
                    const f = await promises.open(p, "r");
                    fileContent = await f.readFile({ encoding: 'utf8' });
                    f.close();
                } catch (ex) {
                    let msg = ex.message || "" + ex;
                    if (msg.match(/no such file/i)) {
                        msg = "File not found: " + p;
                    }
                    return ctxt.error(msg);
                }

                const lines = sectionDict.lines = fileContent.split(RX_CR), len = lines.length;

                let section: Section | undefined, ln: string;
                for (let i = 0; len > i; i++) {
                    ln = lines[i];
                    if (ln.match(RX_SECTION_DEF)) {
                        // create new section
                        const sName = RegExp.$1;
                        if (sectionDict.sections[sName] !== U) {
                            ctxt.error("Invalid file content: '" + sName + "' is defined twice");
                        }
                        section = sectionDict.sections[sName] = { lineIdx: i + 1, nbrOfLines: 0 };
                    } else if (section !== U) {
                        section.nbrOfLines++;
                    }
                }

                if (fileExtension === "ts") {
                    sectionDict.tokens = await tokenize(fileContent);
                }
            }

            const section: Section = sectionDict.sections[sectionName];
            if (section === U) {
                if (!sectionName.match(RX_SECTION_NAME)) {
                    ctxt.error("Invalid section name: '" + sectionName + "'");
                } else {
                    ctxt.error("Section not found: '" + sectionName + "'");
                }
            }

            const k = target.kind;
            if (k !== "#element" && k !== "#fragment" && k!=="#component" && k!=="#paramNode") {
                return ctxt.error("Only elements, fragments, components or param nodes can be used as host", target.pos);
            }

            const host = target as XtrElement | XtrFragment;
            if (host.children !== U && host.children.length > 0) {
                return ctxt.error("Host cannot contain child elements", target.pos);
            }

            createContentNodes(host, section, sectionDict, fileExtension.toLowerCase());
        }
    }

    function createContentNodes(host: XtrElement | XtrFragment, section: Section, sectionDict: SectionDict, fileExtension: string) {
        const lines = sectionDict.lines, len = lines.length;
        if (len === 0 || section.nbrOfLines === 0) return;

        const main = addElement(host, "div"), idx0 = section.lineIdx, tokens = sectionDict.tokens;
        addParam(main, "class", "extract " + fileExtension);

        for (let i = 0; section.nbrOfLines > i; i++) {
            let lineDiv = addElement(main, "div");

            if (tokens !== U) {
                processTokens(lineDiv, tokens[idx0 + i], lines[idx0 + i]);
            } else {
                addText(lineDiv, lines[idx0 + i] || STR_NBSP);
            }
        }
        removeLastEmptyLines(main);
    }
}

function removeLastEmptyLines(mainDiv: XtrElement | XtrFragment) {
    const ch = mainDiv.children;
    if (ch === U) return;
    const len = ch.length;
    let removeIdx = -1;
    if (len > 1) {
        for (let i = len - 1; i > 0; i--) {
            const lineDiv = ch[i] as XtrElement;
            if (lineDiv.children!.length === 1) {
                const c = lineDiv.children![0];
                if (c.kind === "#text") {
                    if (c.value.match(RX_EMPTY_LINE)) {
                        removeIdx = i;
                    }
                } else {
                    break;
                }
            } else {
                break;
            }
        }
    }
    if (removeIdx > -1) {
        ch.splice(removeIdx);
    }
}

interface TokenScope {
    name: string;            // e.g. 'storage.type.function.ts'
    next: TokenScope | null; // next token in the linked list
    container: XtrElement | XtrFragment;
    className: string;
}

function processTokens(host: XtrElement | XtrFragment, tokens: IToken[], line: string) {
    const len = tokens.length;
    let scopes: string[],
        rootScope = createTkScope("#root", host, ""),
        currentTk: TokenScope = rootScope,
        len2: number;
    for (let i = 0; len > i; i++) {
        const t = tokens[i], text = formatTsText(line.substring(t.startIndex, t.endIndex))
        scopes = t.scopes;
        len2 = scopes.length;
        currentTk = rootScope;

        // process current token
        for (let j = 0; len2 > j; j++) {

            let sName = scopes[j];

            if (currentTk.next === null || currentTk.next.name !== sName) {
                // create a new token
                currentTk.next = createTkScope(sName, currentTk.container, currentTk.className);

                // determine if a new span container must be created
                let sClass = getScopeClass(sName);
                if (sClass !== "" && sClass !== currentTk.className) {
                    const cn = currentTk.next.container = addElement(currentTk.container, "span");
                    addParam(cn, "class", sClass);
                    currentTk.next.className = sClass;
                }
            }
            currentTk = currentTk.next;
        }

        // console.log("token: ", text, scopes.join(" / "));
        updateText(currentTk.container, text);
    }
    if (host.children === U || host.children.length === 0) {
        addText(host, STR_NBSP);
    }

    function updateText(host: XtrElement | XtrFragment, text: string) {
        if (text !== "") {
            let ch = host.children;
            if (ch === U || ch.length === 0 || ch[ch.length - 1].kind !== "#text") {
                // create new text elt
                addText(host, text);
            } else {
                let txtNode = ch[ch.length - 1] as XtrText;
                txtNode.value += text;
            }
        }
    }

    function createTkScope(name: string, container: XtrElement | XtrFragment, className: string): TokenScope {
        return {
            name: name,
            container: container,
            next: null,
            className: className
        }
    }
}

function formatTsText(txt: string) {
    return txt.replace(/ /g, STR_NBSP);
}

const SCOPE_CLASSES: (RegExp | string)[] = [
    /^variable/, "hv",
    /^keyword/, "hk",
    /^storage/, "hr",
    /^string/, "hs",
    /^entity.name.function/, "hf",
    /^entity.name.type/, "ht",
    /^entity.name.tag/, "hg",
    /^entity.other/, "ho",
    /^entity/, "he",
    /^comment/, "hc",
    /^constant/, "hn",
    /^support.type/, "hy",
    /^punctuation.definition.tag/, "hp",
    /^punctuation.section.embedded/, "hd"
]

function getScopeClass(nm: string): string {
    let len = SCOPE_CLASSES.length;
    for (let i = 0; len > i; i += 2) {
        if (nm.match(SCOPE_CLASSES[i] as RegExp)) {
            return SCOPE_CLASSES[i + 1] as string;
        }
    }
    return "";
}

// comment { "foreground": "#6A9955" } // comments
// string { "foreground": "#ce9178" } // string literals
// constant.numeric { "foreground": "#b5cea8" } // numeric literals e.g. 123
// constant.language  // built-in constants - e.g. *
// constant.character
// constant.character.escape { "foreground": "#d7ba7d" }
// constant.other
// variable { "foreground": "#9CDCFE" } // var identifier
// variable.parameter
// keyword
// keyword.operator { "foreground": "#d4d4d4" } // =
// keyword.control { "foreground": "#C586C0" } // else / import
// storage
// storage.type { "foreground": "#569cd6" } // function/const/=>
// entity.name.class
// entity.name.type { "foreground": "#4EC9B0" } // Promise
// entity.name.function { "foreground": "#DCDCAA" } // function identifier
// entity.name.tag
// entity.other
// entity.other.attribute { "foreground": "#4EC9B0" }
// entity.other.attribute-name
// support.function // library function
// support.constant // library constant
// support.type
// support.class
// support.other.variable
// punctuation.definition.tag { "foreground": "#808080" }
// punctuation.section.embedded { "foreground": "#569cd6" }