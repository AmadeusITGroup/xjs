const U = undefined,
    NO_VALUE: XtrRef = { kind: "#ref", identifier: "" },
    RX_TEXT_SPECIALS = /(\<|\!|\/)/g,
    RX_CDATA_SPECIALS = /\<\/\!cdata\>/g;

// -------------------------------------------------------------------------------------
// types

export interface XtrFragment {
    kind: "#fragment";
    children: XtrChildElement[];
    ref(value: string): XtrRef;
    refs: XtrRef[];
    pos: number;
    params?: XtrParam[];
    toString(startIndent?: string, indent?: string, minimal?: boolean, multiline?: boolean): string;
}

export interface XtrRef {
    kind: "#ref";
    identifier: string;
    target?: any;
}

export interface XtrElement {
    kind: "#element" | "#component" | "#paramNode" | "#decoratorNode";
    name?: string;
    nameRef?: string;
    params?: XtrParam[];
    children?: XtrChildElement[];
    pos: number;
    toString(startIndent?: string, indent?: string, minimal?: boolean): string;
}

export interface XtrText {
    kind: "#text";
    value: string;
    pos: number;
    params?: XtrParam[];
    toString(startIndent?: string, indent?: string): string;
}

export interface XtrCData {
    kind: "#cdata";
    content: string;
    pos: number;
    params?: XtrParam[];
    toString(startIndent?: string, indent?: string): string;
}

export interface XtrParam {
    kind: "#param" | "#property" | "#decorator" | "#label";
    name: string;
    holdsValue: boolean;
    pos: number;
    value?: any;
    valueRef?: string;
    params?: XtrParam[]; // for decorators
}

export type XtrParamHost = XtrElement | XtrParam | XtrFragment | XtrCData;

export interface XtrPreProcessorFactory {
    (): XtrPreProcessor;
}

export interface XtrParamDictionary {
    [name: string]: XtrParam;
}

export interface XtrPreProcessor {
    // todo: support setup(): would be call for container nodes before the node content is processed
    setup?(target: XtrParamHost, params?: XtrParamDictionary, ctxt?: XtrPreProcessorCtxt): void;
    // process is called when all the node attributes and content are loaded
    process?(target: XtrParamHost, params?: XtrParamDictionary, ctxt?: XtrPreProcessorCtxt): void;
}

export interface XtrPreProcessorCtxt {
    rootFragment: XtrFragment;
    parent: XtrParamHost | null; // null for root fragment
    fileId: string; // e.g. /a/b/c/myfile.ts
    error: (msg: string, pos?: number) => void;
    preProcessors: { [name: string]: XtrPreProcessorFactory };
}

export type XtrChildElement = XtrFragment | XtrElement | XtrText | XtrCData;

// -------------------------------------------------------------------------------------
// Tree API to dynamically create an XTR tree and bypass the XTR parser

export function createXtrFragment(root = true, pos = -1): XtrFragment {
    return new XFragment(root, pos);
}

export function createXtrElement(kind: "#element" | "#component" | "#paramNode" | "#decoratorNode", name?: string, nameRef?: string, pos = -1): XtrElement {
    return new XElement(kind, name, nameRef, pos);
}

export function createXtrCData(content: string, pos = -1): XtrCData {
    return new XCData(content, pos);
}

export function createXtrText(text: string, pos = -1): XtrText {
    return new XText(text, pos);
}

export function addElement(parent: XtrFragment | XtrElement, name: string, pos = -1): XtrElement {
    return pushChild(parent, createXtrElement("#element", name, U, pos)) as XtrElement;
}

export function addComponent(parent: XtrFragment | XtrElement, ref: XtrRef, pos = -1): XtrElement {
    return pushChild(parent, createXtrElement("#component", U, ref.identifier, pos)) as XtrElement;
}

export function addFragment(parent: XtrFragment | XtrElement, pos = -1): XtrFragment {
    return pushChild(parent, createXtrFragment(false, pos)) as XtrFragment;
}

export function addCData(parent: XtrFragment | XtrElement, content: string, pos = -1): XtrCData {
    return pushChild(parent, createXtrCData(content, pos)) as XtrCData;
}

export function addParamNode(parent: XtrFragment | XtrElement, name: string, pos = -1): XtrElement {
    return pushChild(parent, createXtrElement("#paramNode", name, U, pos)) as XtrElement;
}

export function addText(parent: XtrFragment | XtrElement, text: string, pos = -1) {
    pushChild(parent, createXtrText(text, pos));
}

export function addParam(parent: XtrParamHost, name: string, value?: boolean | number | string | XtrRef, isProperty?: boolean, pos = -1) {
    return pushParam(parent, new XParam(isProperty === true ? "#property" : "#param", name, value, pos));
}

export function addDecorator(parent: XtrParamHost, nameRef: XtrRef, value: boolean | number | string | XtrRef = NO_VALUE, pos = -1) {
    return pushParam(parent, new XParam("#decorator", nameRef.identifier, value, pos));
}

export function addLabel(parent: XtrParamHost, name: string, value?: string | XtrRef, pos = -1) {
    return pushParam(parent, new XParam("#label", name, value, pos));
}

const INVALID_REF: XtrRef = {
    kind: "#ref",
    identifier: "#invalid"
}

class XFragment implements XtrFragment {
    kind: "#fragment" = "#fragment";
    params?: XtrParam[];
    _refs: { [refName: string]: XtrRef } = {};

    constructor(private _isRoot = true, public pos = -1) { }

    children: (XtrElement | XtrText)[] = [];
    ref(name: string): XtrRef {
        if (this._isRoot) {
            let ref: XtrRef = {
                kind: "#ref",
                identifier: name
            }
            this._refs[name] = ref;
            return ref;
        } else {
            console.log("[XTR AST] references can only be created on root fragments - please check '" + name + "'");
            return INVALID_REF;
        }
    }

    get refs(): XtrRef[] {
        let r: XtrRef[] = [], refs = this._refs;
        for (let k in refs) {
            if (refs.hasOwnProperty(k)) {
                r.push(refs[k]);
            }
        }
        return r;
    }

    toString(startIndent: string = "", indent: string = "  ", minimal = false, multiline = true): string {
        if (this._isRoot) {
            if (minimal) multiline = false;
            return serializeChildren(this.children, startIndent, indent, multiline, minimal) + (multiline ? "\n" : "");
        } else {
            return serializeContainer(this, startIndent, indent, minimal);
        }
    }
}

const PREFIXES = {
    "#component": "*",
    "#decoratorNode": "@",
    "#element": "",
    "#fragment": "",
    "#paramNode": ".",
    "#param": "",
    "#property": "[",
    "#decorator": "@",
    "#label": "#"
}, SUFFIXES = {
    "#param": "",
    "#property": "]",
    "#decorator": "",
    "#label": ""
}

function serializeChildren(nodes: (XtrChildElement[]) | undefined, startIndent: string, indent: string, multiline: boolean, minimal = false) {
    if (nodes === U || !nodes.length) return "";
    let buf: string[] = [];
    for (let node of nodes) {
        let k = node.kind;
        if (multiline) {
            buf.push("\n" + startIndent);
        }
        if (k === "#text") {
            buf.push((node as XtrText).toString());
        } else {
            buf.push(serializeContainer(node as any, startIndent, indent, minimal));
        }
    }
    return buf.join("");
}

function serializeContainer(node: XtrFragment | XtrElement | XtrCData, startIndent = "", indent = "", minimal = false): string {
    let k = node.kind, buf: string[] = [], start = "";
    if (k === "#fragment") {
        start = "<!" + serializeParams(node.params);
        if (minimal && start === "<!") {
            start = "";
        }
    } else if (k === "#cdata") {
        start = "<!cdata" + serializeParams(node.params);
    } else {
        start = "<" + PREFIXES[k] + ((node as XtrElement).name || (node as XtrElement).nameRef) + serializeParams(node.params);
    }

    buf.push(start);
    if (k !== "#cdata" && (node as XtrFragment | XtrElement).children && (node as XtrFragment | XtrElement).children!.length > 0) {
        let n = node as XtrFragment | XtrElement; { }
        if (start !== "") {
            buf.push(">");
        }
        let mLine = !minimal && (n.children!.length > 1 || start.length > 25 || (n.children!.length === 1 && n.children![0].kind !== "#text")); // multi line
        buf.push(serializeChildren(n.children, startIndent + indent, indent, mLine, minimal));
        if (mLine) {
            buf.push("\n" + startIndent + "</>"); // no need for name as we have indentation
        } else {
            if (k === "#fragment") {
                if (start !== "") {
                    buf.push("</!>");
                }
            } else {
                buf.push(minimal ? "</>" : "</" + PREFIXES[k] + ((n as XtrElement).name || (n as XtrElement).nameRef) + ">");
            }
        }
    } else if (k === "#cdata") {
        buf.push(">" + (node as XtrCData).content.replace(RX_CDATA_SPECIALS, "!</!cdata>") + "</!cdata>");
    } else {
        if (minimal && start === "") return "";
        buf.push("/>");
    }
    return buf.join("");
}

function serializeParams(params?: XtrParam[], firstSeparator: string = " "): string {
    if (params === U || params.length === 0) return "";
    let buf: string[] = [];
    for (let p of params) {
        buf.push((buf.length === 0) ? firstSeparator : " ");
        buf.push(PREFIXES[p.kind] + p.name + SUFFIXES[p.kind]);
        if (p.holdsValue) {
            if (p.valueRef !== U) {
                buf.push("={" + p.valueRef + "}");
            } else if (typeof p.value === "boolean" || typeof p.value === "number") {
                buf.push("=" + p.value);
            } else {
                // string
                buf.push("='" + encodeText("" + p.value) + "'");
            }
        } else if (p.kind === "#decorator" && p.params) {
            let s = serializeParams(p.params, "");
            if (s.length) {
                buf.push("(" + s + ")");
            }
        }
    }
    return buf.join("");
}

function encodeText(t: string) {
    return t.replace(/\'/g, "\\'")
}

class XElement implements XtrElement {
    params?: XtrParam[];
    children?: (XtrElement | XtrText)[];
    constructor(public kind: "#element" | "#component" | "#paramNode" | "#decoratorNode", public name?: string, public nameRef?: string, public pos = -1) { }

    toString(startIndent: string = "", indent: string = "", minimal = false) {
        return serializeContainer(this, startIndent, indent, minimal);
    }
}

function pushChild(parent: XtrFragment | XtrElement, child: XtrElement | XtrText | XtrFragment | XtrCData) {
    if (!parent.children) {
        parent.children = [child];
    } else {
        parent.children!.push(child);
    }
    return child;
}

class XText implements XtrText {
    kind: "#text" = "#text";
    constructor(public value: string, public pos = -1) { }
    toString() {
        return this.value.replace(RX_TEXT_SPECIALS, "!$1");
    }
}

class XCData implements XtrCData {
    kind: "#cdata" = "#cdata";
    constructor(public content: string, public pos = -1) { }
    toString(startIndent: string = "", indent: string = "") {
        return serializeContainer(this, startIndent, indent);
    }
}

class XParam implements XtrParam {
    params?: XtrParam[];
    valueRef?: string;
    holdsValue: boolean = true;

    constructor(public kind: "#param" | "#property" | "#decorator" | "#label", public name: string, public value?: boolean | number | string | XtrRef, public pos = -1) {
        if (value === U || value === NO_VALUE) {
            this.holdsValue = false;
            this.value = U;
        } else if ((value as XtrRef).kind === "#ref") {
            this.valueRef = (value as XtrRef).identifier;
        }
    }
}

function pushParam(elt: XtrParamHost, param: XtrParam): XtrParam {
    if (!elt.params) {
        elt.params = [param];
    } else {
        elt.params.push(param);
    }
    return param;
}