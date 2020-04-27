import { XjsElement, XjsFragment, XjsParamHost, XjsParamDictionary, XjsPreProcessorCtxt, XjsCData, XjsText } from './../xjs/types';
import * as vsTM from 'vscode-textmate';
import xjsTmGrammar from './../tm-grammar/xjs.tmLanguage.json';
import { createElement, addContent, createParam, addParam, createText } from '../xjs/parser';

const U = undefined,
    RX_SPACES = / /g,
    RX_EMPTY_LINE = /^\s*$/,
    STR_NBSP = '\u00A0'; // non-breaking space

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
];

const XJS_REGISTRY = new vsTM.Registry({
    loadGrammar: async function () {
        //return vsTM.parseRawGrammar(grammar, 'xjs.tmLanguage.json');
        return xjsTmGrammar as any;
    }
});

let xjsGrammar: vsTM.IGrammar | null | undefined;

/**
 * @@ts preprocessor
 * e.g. $fragment`<!cdata @@ts> const x=123; </!cdata>`
 * @param class:string (default param) a css class to attach to the container element
 * @param trim:boolean [optional] tell if the start & end empty lines should be removed (default: true)
 */
export function ts() {
    return {
        async process(target: XjsParamHost, params: XjsParamDictionary, ctxt: XjsPreProcessorCtxt) {
            let trim = true;
            if (params["trim"]) {
                trim = params["trim"].value === true;
            }
            if (target.kind !== "#cdata") {
                ctxt.error("pre-processor can only be used on <!cdata> sections");
            }
            const classParam = params["class"] || params["$$default"];
            let classValue = "ts_code";
            if (classParam) {
                classValue = "ts_code " + (classParam.value || "");
            }

            // replace the cdata by a div element
            const p = ctxt.parent,
                content = p!.content!,
                idx = content.indexOf(target as any),
                tsCode = (target as XjsCData).text;
            if (idx === -1) {
                // fwk error - should not occur
                ctxt.error("Unexpected error: cdata not found in parent element");
            }
            const oneLine = tsCode.indexOf("\n") === -1;

            let host = createElement("div"); // could also be createFragment
            addParam(createParam("class", classValue), host);


            // tokenize and appendLineHighlightElts
            const lines = tsCode.split('\n'), tokens = await tokenize(tsCode);
            appendHighlightElts(lines, tokens, host, trim);

            if (oneLine) {
                // remove the main host and change the line div into a span
                host = host.content![0] as XjsElement;
                host.name = "span";
                addParam(createParam("class", classValue), host);
            }
            content.splice(idx, 1, host);
        }
    }
}

/**
 * Tokenize a ts+xjs string composed of multiple lines
 * @param src the ts string (that may contain xjs templates)
 * @return an array of array of tokens
 *   the first-level array corresponds to the lines of the src string
 *   the second-level array corresponds to the tokens in a given line
 */
export async function tokenize(src: string): Promise<vsTM.IToken[][]> {
    if (!xjsGrammar) {
        xjsGrammar = await XJS_REGISTRY.loadGrammar("source.ts");
    }

    let ruleStack: vsTM.StackElement | undefined, lines = src.split("\n"), result: vsTM.IToken[][] = [];
    for (let i = 0; i < lines.length; i++) {
        const r = xjsGrammar!.tokenizeLine(lines[i], <any>ruleStack);
        result.push(r.tokens);
        ruleStack = r.ruleStack;
    }
    return result;
}

type LineHost = XjsElement | XjsFragment;

interface TokenScope {
    name: string;            // e.g. 'storage.type.function.ts'
    next: TokenScope | null; // next token in the linked list
    container: LineHost;
    className: string;
}

/**
 * Append a series of line <div> elements containing sub-elements corresponding to the ts code highlighting
 * @param lines the list of lines, as in the original ts file
 * @param tokens the list of tokens, as returned by tokenize()
 * @param host the host element in which to append the line <div> elements
 * @param trim [optional] if true, empty lines at start & end will be removed (default = true)
 * @param startIdx [optional] the index of the first line (default = 0)
 * @param lastIdx [optional] the index of the last line (default = lines.length-1)
 */
export function appendHighlightElts(lines: string[], tokens: vsTM.IToken[][], host: XjsElement | XjsFragment, trim = true, startIdx: number = 0, lastIdx?: number) {
    const len = lines.length;
    let idxFirst = startIdx, idxLast = lastIdx || len - 1;
    if (trim) {
        for (let i = startIdx; len > i; i++) {
            if (lines[i].match(RX_EMPTY_LINE)) {
                idxFirst = i + 1;
            } else {
                break;
            }
        }
        if (idxFirst !== len) {
            for (let i = idxLast; i >= idxFirst; i--) {
                if (lines[i].match(RX_EMPTY_LINE)) {
                    idxLast = i - 1;
                } else {
                    break;
                }
            }
        }
    }
    if (idxFirst !== len) for (let i = idxFirst; idxLast >= i; i++) {
        appendLineHighlightElts(lines[i], tokens[i], host);
    }
}

/**
 * Create and append a line DIV containing SPAN elements for each tm token
 * @param line the line as string
 * @param tokens the array of tokens corresponding to the line parameter
 * @param host the Xjs element or fragment that will host the new line div
 */
export function appendLineHighlightElts(line: string, tokens: vsTM.IToken[], host: LineHost) {
    const lineDiv = createElement("div");
    addContent(lineDiv, host);
    if (line === "") {
        line = STR_NBSP;
    }
    const len = tokens.length;
    let scopes: string[],
        rootScope = createTkScope("#root", lineDiv, ""),
        currentTk: TokenScope = rootScope,
        len2: number;
    for (let i = 0; len > i; i++) {
        // process each token
        const tk = tokens[i],
            text = line.substring(tk.startIndex, tk.endIndex).replace(RX_SPACES, STR_NBSP);
        scopes = tk.scopes;
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
                    const cn = currentTk.next.container = createElement("span");
                    addContent(cn, currentTk.container);
                    addParam(createParam("class", sClass), cn);
                    currentTk.next.className = sClass;
                }
            }
            currentTk = currentTk.next;
        }

        // console.log("token: ", text, scopes.join(" / "));
        appendText(text, currentTk.container);
        currentTk.next = null;
    }
    // if not content has been created, create a line with a non-breaking space
    if (lineDiv.content === U || lineDiv.content.length === 0) {
        appendText(STR_NBSP, lineDiv)
    }

    function appendText(text: string, host: LineHost) {
        if (host.content) {
            // append text to the last text node if any
            const last = host.content[host.content.length - 1];
            if (last.kind === "#textNode") {
                const tf = (last as XjsText).textFragments;
                tf[tf.length - 1] += text;
                return;
            }
        }
        addContent(createText([text]), host);
    }

    function createTkScope(name: string, container: LineHost, className: string): TokenScope {
        return {
            name: name,
            container: container,
            next: null,
            className: className
        }
    }
}

function getScopeClass(nm: string): string {
    let len = SCOPE_CLASSES.length;
    for (let i = 0; len > i; i += 2) {
        if (nm.match(SCOPE_CLASSES[i] as RegExp)) {
            return SCOPE_CLASSES[i + 1] as string;
        }
    }
    return "";
}