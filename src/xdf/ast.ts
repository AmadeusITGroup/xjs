const U = undefined, NO_VALUE: XdfRef = { kind: "#ref", identifier: "" };

// -------------------------------------------------------------------------------------
// types

export interface XdfFragment {
    kind: "#fragment";
    children: XdfChildElement[];
    ref(value: string): XdfRef;
    refs: XdfRef[];
    pos: number;
    params?: XdfParam[];
    toString(startIndent?: string, indent?: string, minimal?: boolean, multiline?: boolean): string;
}

export interface XdfRef {
    kind: "#ref";
    identifier: string;
    target?: any;
}

export interface XdfElement {
    kind: "#element" | "#component" | "#paramNode" | "#decoratorNode";
    name?: string;
    nameRef?: string;
    params?: XdfParam[];
    children?: XdfChildElement[];
    pos: number;
    toString(startIndent?: string, indent?: string, minimal?: boolean): string;
}

export interface XdfText {
    kind: "#text";
    value: string;
    pos: number;
    params?: XdfParam[];
    toString(startIndent?: string, indent?: string): string;
}

export interface XdfCData {
    kind: "#cdata";
    content: string;
    pos: number;
    params?: XdfParam[];
    toString(startIndent?: string, indent?: string): string;
}

export interface XdfParam {
    kind: "#param" | "#property" | "#decorator" | "#label";
    name: string;
    holdsValue: boolean;
    pos: number;
    value?: any;
    valueRef?: string;
    params?: XdfParam[]; // for decorators
}

export type XdfParamHost = XdfElement | XdfParam | XdfFragment | XdfCData;

export interface XdfPreProcessorFactory {
    (): XdfPreProcessor;
}

export interface XdfParamDictionary {
    [name: string]: XdfParam;
}

export interface XdfPreProcessor {
    // todo: support setup(): would be call for container nodes before the node content is processed
    setup?(target: XdfParamHost, params?: XdfParamDictionary, ctxt?: XdfPreProcessorCtxt): void;
    // process is called when all the node attributes and content are loaded
    process?(target: XdfParamHost, params?: XdfParamDictionary, ctxt?: XdfPreProcessorCtxt): void;
}

export interface XdfPreProcessorCtxt {
    rootFragment: XdfFragment;
    parent: XdfParamHost | null; // null for root fragment
    fileId: string; // e.g. /a/b/c/myfile.xdf
    error: (msg: string, pos?: number) => void;
    preProcessors: { [name: string]: XdfPreProcessorFactory };
}

export type XdfChildElement = XdfFragment | XdfElement | XdfText | XdfCData;

// -------------------------------------------------------------------------------------
// Tree API to dynamically create an XDF tree and bypass the XDF parser

export function createXdfFragment(root = true, pos = -1): XdfFragment {
    return new XFragment(root, pos);
}

export function createXdfElement(kind: "#element" | "#component" | "#paramNode" | "#decoratorNode", name?: string, nameRef?: string, pos = -1): XdfElement {
    return new XElement(kind, name, nameRef, pos);
}

export function createXdfCData(content: string, pos = -1): XdfCData {
    return new XCData(content, pos);
}

export function createXdfText(text: string, pos = -1): XdfText {
    return new XText(text, pos);
}

export function addElement(parent: XdfFragment | XdfElement, name: string, pos = -1): XdfElement {
    return pushChild(parent, createXdfElement("#element", name, U, pos)) as XdfElement;
}

export function addComponent(parent: XdfFragment | XdfElement, ref: XdfRef, pos = -1): XdfElement {
    return pushChild(parent, createXdfElement("#component", U, ref.identifier, pos)) as XdfElement;
}

export function addFragment(parent: XdfFragment | XdfElement, pos = -1): XdfFragment {
    return pushChild(parent, createXdfFragment(false, pos)) as XdfFragment;
}

export function addCData(parent: XdfFragment | XdfElement, content: string, pos = -1): XdfCData {
    return pushChild(parent, createXdfCData(content, pos)) as XdfCData;
}

export function addParamNode(parent: XdfFragment | XdfElement, name: string, pos = -1): XdfElement {
    return pushChild(parent, createXdfElement("#paramNode", name, U, pos)) as XdfElement;
}

export function addText(parent: XdfFragment | XdfElement, text: string, pos = -1) {
    pushChild(parent, createXdfText(text, pos));
}

export function addParam(parent: XdfParamHost, name: string, value?: boolean | number | string | XdfRef, isProperty?: boolean, pos = -1) {
    return pushParam(parent, new XParam(isProperty === true ? "#property" : "#param", name, value, pos));
}

export function addDecorator(parent: XdfParamHost, nameRef: XdfRef, value: boolean | number | string | XdfRef = NO_VALUE, pos = -1) {
    return pushParam(parent, new XParam("#decorator", nameRef.identifier, value, pos));
}

export function addLabel(parent: XdfParamHost, name: string, value?: string | XdfRef, pos = -1) {
    return pushParam(parent, new XParam("#label", name, value, pos));
}

const INVALID_REF: XdfRef = {
    kind: "#ref",
    identifier: "#invalid"
}

class XFragment implements XdfFragment {
    kind: "#fragment" = "#fragment";
    params?: XdfParam[];
    _refs: { [refName: string]: XdfRef } = {};

    constructor(private _isRoot = true, public pos = -1) { }

    children: (XdfElement | XdfText)[] = [];
    ref(name: string): XdfRef {
        if (this._isRoot) {
            let ref: XdfRef = {
                kind: "#ref",
                identifier: name
            }
            this._refs[name] = ref;
            return ref;
        } else {
            console.log("[XDF AST] references can only be created on root fragments - please check '" + name + "'");
            return INVALID_REF;
        }
    }

    get refs(): XdfRef[] {
        let r: XdfRef[] = [], refs = this._refs;
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

function serializeChildren(nodes: (XdfChildElement[]) | undefined, startIndent: string, indent: string, multiline: boolean, minimal = false) {
    if (nodes === U || !nodes.length) return "";
    let buf: string[] = [];
    for (let node of nodes) {
        let k = node.kind;
        if (multiline) {
            buf.push("\n" + startIndent);
        }
        if (k === "#text") {
            buf.push((node as XdfText).toString());
        } else {
            buf.push(serializeContainer(node as any, startIndent, indent, minimal));
        }
    }
    return buf.join("");
}

function serializeContainer(node: XdfFragment | XdfElement | XdfCData, startIndent = "", indent = "", minimal = false): string {
    let k = node.kind, buf: string[] = [], start = "";
    if (k === "#fragment") {
        start = "<!" + serializeParams(node.params);
        if (minimal && start === "<!") {
            start = "";
        }
    } else if (k === "#cdata") {
        start = "<!cdata" + serializeParams(node.params);
    } else {
        start = "<" + PREFIXES[k] + ((node as XdfElement).name || (node as XdfElement).nameRef) + serializeParams(node.params);
    }

    buf.push(start);
    if (k !== "#cdata" && (node as XdfFragment | XdfElement).children && (node as XdfFragment | XdfElement).children!.length > 0) {
        let n = node as XdfFragment | XdfElement; { }
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
                buf.push(minimal ? "</>" : "</" + PREFIXES[k] + ((n as XdfElement).name || (n as XdfElement).nameRef) + ">");
            }
        }
    } else if (k === "#cdata") {
        buf.push(">" + (node as XdfCData).content + "</!cdata>");
    } else {
        if (minimal && start === "") return "";
        buf.push("/>");
    }
    return buf.join("");
}

function serializeParams(params?: XdfParam[], firstSeparator: string = " "): string {
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

class XElement implements XdfElement {
    params?: XdfParam[];
    children?: (XdfElement | XdfText)[];
    constructor(public kind: "#element" | "#component" | "#paramNode" | "#decoratorNode", public name?: string, public nameRef?: string, public pos = -1) { }

    toString(startIndent: string = "", indent: string = "", minimal = false) {
        return serializeContainer(this, startIndent, indent, minimal);
    }
}

function pushChild(parent: XdfFragment | XdfElement, child: XdfElement | XdfText | XdfFragment | XdfCData) {
    if (!parent.children) {
        parent.children = [child];
    } else {
        parent.children!.push(child);
    }
    return child;
}

class XText implements XdfText {
    kind: "#text" = "#text";
    constructor(public value: string, public pos = -1) { }
    toString() {
        return this.value;
    }
}

class XCData implements XdfCData {
    kind: "#cdata" = "#cdata";
    constructor(public content: string, public pos = -1) { }
    toString(startIndent: string = "", indent: string = "") {
        return serializeContainer(this, startIndent, indent);
    }
}

class XParam implements XdfParam {
    params?: XdfParam[];
    valueRef?: string;
    holdsValue: boolean = true;

    constructor(public kind: "#param" | "#property" | "#decorator" | "#label", public name: string, public value?: boolean | number | string | XdfRef, public pos = -1) {
        if (value === U || value === NO_VALUE) {
            this.holdsValue = false;
            this.value = U;
        } else if ((value as XdfRef).kind === "#ref") {
            this.valueRef = (value as XdfRef).identifier;
        }
    }
}

function pushParam(elt: XdfParamHost, param: XdfParam): XdfParam {
    if (!elt.params) {
        elt.params = [param];
    } else {
        elt.params.push(param);
    }
    return param;
}