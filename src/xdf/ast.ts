const U = undefined, NO_VALUE: XdfRef = { kind: "#ref", identifier: "" };

// -------------------------------------------------------------------------------------
// types

export interface XdfFragment {
    kind: "#fragment";
    children: XdfChildElement[];
    ref(value: string): XdfRef;
    refs: XdfRef[];
    params?: XdfParam[];
    toString(indent?: string): string;
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
}

export interface XdfText {
    kind: "#text";
    value: string;
    params?: XdfParam[];
}

export interface XdfCData {
    kind: "#cdata";
    content: string;
    params?: XdfParam[];
}

export interface XdfParam {
    kind: "#param" | "#property" | "#decorator" | "#label";
    name: string;
    holdsValue: boolean;
    value?: any;
    valueRef?: string;
    params?: XdfParam[]; // for decorators
}

export type XdfParamHost = XdfElement | XdfParam | XdfFragment | XdfCData;

export interface XdfPreProcessor {
    (target: XdfParamHost, params?: XdfParam[], ctxt?: XdfPreProcessorCtxt): void;
}

export interface XdfPreProcessorCtxt {
    rootFragment: XdfFragment;
    parent: XdfParamHost;
    fileName: string;
    filePath: string;
    error: (msg: string) => void;
    preProcessors: { [name: string]: XdfPreProcessor };
}

export type XdfChildElement = XdfFragment | XdfElement | XdfText | XdfCData;

// -------------------------------------------------------------------------------------
// Tree API to dynamically create an XDF tree and bypass the XDF parser

export function createXdfFragment(root = true): XdfFragment {
    return new XFragment(root);
}

export function createXdfElement(kind: "#element" | "#component" | "#paramNode" | "#decoratorNode", name?: string, nameRef?: string): XdfElement {
    return new XElement(kind, name, nameRef);
}

export function createXdfCData(content: string): XdfCData {
    return new XCData(content);
}

export function createXdfText(text: string): XdfText {
    return new XText(text);
}

export function addElement(parent: XdfFragment | XdfElement, name: string): XdfElement {
    return pushChild(parent, createXdfElement("#element", name)) as XdfElement;
}

export function addComponent(parent: XdfFragment | XdfElement, ref: XdfRef): XdfElement {
    return pushChild(parent, createXdfElement("#component", U, ref.identifier)) as XdfElement;
}

export function addFragment(parent: XdfFragment | XdfElement): XdfFragment {
    return pushChild(parent, createXdfFragment(false)) as XdfFragment;
}

export function addCData(parent: XdfFragment | XdfElement, content: string): XdfCData {
    return pushChild(parent, createXdfCData(content)) as XdfCData;
}

export function addParamNode(parent: XdfFragment | XdfElement, name: string): XdfElement {
    return pushChild(parent, createXdfElement("#paramNode", name)) as XdfElement;
}

export function addText(parent: XdfFragment | XdfElement, text: string) {
    pushChild(parent, createXdfText(text));
}

export function addParam(parent: XdfParamHost, name: string, value?: boolean | number | string | XdfRef, isProperty?: boolean) {
    return pushParam(parent, new XParam(isProperty === true ? "#property" : "#param", name, value));
}

export function addDecorator(parent: XdfParamHost, nameRef: XdfRef, value: boolean | number | string | XdfRef = NO_VALUE) {
    return pushParam(parent, new XParam("#decorator", nameRef.identifier, value));
}

export function addLabel(parent: XdfParamHost, name: string, value?: string | XdfRef) {
    return pushParam(parent, new XParam("#label", name, value));
}

const INVALID_REF: XdfRef = {
    kind: "#ref",
    identifier: "#invalid"
}

class XFragment implements XdfFragment {
    kind: "#fragment" = "#fragment";
    params?: XdfParam[];
    _refs: { [refName: string]: XdfRef } = {};

    constructor(private _isRoot = true) { }

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

    toString(indent?: string): string {
        return serialize(this.children, "", indent === U ? "  " : indent, true) + "\n";
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

function serialize(nodes: XdfChildElement[], startIndent: string, indent: string, multiline: boolean) {
    if (!nodes.length) return "";
    let buf: string[] = [], start: string;
    for (let node of nodes) {
        if (multiline) {
            buf.push("\n" + startIndent);
        }
        let k = node.kind;
        if (k === "#text") {
            buf.push((node as XdfText).value);
        } else {
            let n = node as XdfFragment | XdfElement;
            if (k === "#fragment") {
                start = "<!" + serializeParams(n.params);
            } else if (k === "#cdata") {
                start = "<!cdata" + serializeParams(n.params);
            } else {
                start = "<" + PREFIXES[k] + ((n as XdfElement).name || (n as XdfElement).nameRef) + serializeParams(n.params);
            }

            buf.push(start);
            if (k !== "#cdata" && n.children) {
                buf.push(">");
                let mLine = (n.children.length > 1 || start.length > 25 || (n.children.length === 1 && n.children[0].kind !== "#text")); // multi line
                buf.push(serialize(n.children, startIndent + indent, indent, mLine));
                if (mLine) {
                    buf.push("\n" + startIndent + "</>"); // no need for name as we have indentation
                } else {
                    if (k === "#fragment") {
                        buf.push("</!>");
                    } else {
                        buf.push("</" + PREFIXES[k] + ((n as XdfElement).name || (n as XdfElement).nameRef) + ">");
                    }

                }
            } else if (k === "#cdata") {
                buf.push(">" + (node as XdfCData).content + "</!cdata>");
            } else {
                buf.push("/>");
            }
        }
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
    constructor(public kind: "#element" | "#component" | "#paramNode" | "#decoratorNode", public name?: string, public nameRef?: string) { }
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
    constructor(public value: string) { }
}

class XCData implements XdfCData {
    kind: "#cdata" = "#cdata";
    constructor(public content: string) { }
}

class XParam implements XdfParam {
    params?: XdfParam[];
    valueRef?: string;
    holdsValue: boolean = true;

    constructor(public kind: "#param" | "#property" | "#decorator" | "#label", public name: string, public value?: boolean | number | string | XdfRef) {
        if (value === U || value === NO_VALUE) {
            this.holdsValue = false;
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