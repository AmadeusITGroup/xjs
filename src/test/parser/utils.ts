import { XjsCData, XjsElement } from './../../xjs/types';
import { XjsNode, XjsTplFunction, XjsText, XjsExpression, XjsFragment, XjsJsBlock, XjsDecorator, XjsJsStatement, XjsParamHost, XjsContentHost } from '../../xjs/types';
import { parse } from '../../xjs/parser';

const U = undefined;

export let ast = {
    rootPrefix: "        ",
    indent: "    ",

    // this api allows to trigger the vs-code text mate completion
    async $template(strings: TemplateStringsArray, log = false) {
        let root = await parse(strings[0]);
        return stringify(root, log);
    },

    async $fragment(strings: TemplateStringsArray, ...values: any[]) {
        let tpl = "";
        if (values.length === 0) {
            tpl = strings[0];
        } else {
            let buf: string[] = [], len1 = strings.length, len2 = values.length;
            for (let i = 0; len1 > i; i++) {
                buf.push(strings[i]);
                if (i < len2) {
                    buf.push(values[i]);
                }
            }
            tpl = buf.join("");
        }

        let root = await parse(tpl, { templateType: "$fragment" });
        return stringify(root);
    },

    async initIndent(tpl: string, log = false) {
        let root = await parse(tpl);
        if (!root) {
            return "ERROR";
        }
        if (log) console.log(`'${(root as XjsTplFunction).indent}'`);
        return (root as XjsTplFunction).indent;
    }
}

export function stringify(root: XjsTplFunction | XjsFragment | XjsElement, log = false) {
    if (!root) {
        return "ERROR";
    }

    let lines: string[] = [];
    lines.push("");
    serialize(root, lines, ast.rootPrefix + ast.indent);
    lines.push(ast.rootPrefix);
    let r = lines.join("\n");
    if (log) console.log(r);
    return r;
}

function serialize(n: XjsNode, lines: string[], prefix: string) {
    switch (n.kind) {
        case "#tplFunction":
            return tplFunction(n as XjsTplFunction, lines, prefix);
        case "#textNode":
            return textNode(n as XjsText, lines, prefix);
        case "#expression":
            return expression(n as XjsExpression, lines, prefix);
        case "#element":
        case "#fragment":
        case "#component":
        case "#decoratorNode":
        case "#paramNode":
        case "#cdata":
            return fragment(n as XjsFragment, lines, prefix);
        case "#jsStatement":
            return jsStatement(n as XjsJsStatement, lines, prefix);
        case "#jsBlock":
            return jsBlock(n as XjsJsBlock, lines, prefix);
        default:
            return lines.push("Unsupported XjsNode: " + n.kind);
    }
}

function tplFunction(n: XjsTplFunction, lines: string[], prefix: string) {
    const args: string[] = [];
    if (n.arguments) {
        for (let arg of n.arguments) {
            const optional = arg.optional ? "?" : "";
            let def = "";
            if (arg.typeRef) {
                def = arg.name + optional + ":" + arg.typeRef;
            } else {
                def = arg.name + optional;
            }
            if (arg.defaultValue) {
                def += "=" + arg.defaultValue;
            }
            args.push(def);
        }
    }
    const nm = n.name !== U ? " " + n.name + " " : "";
    lines.push(`${prefix}#tplFunction${nm}(${args.join(', ')})`);
    if (n.content) {
        for (let c of n.content) {
            serialize(c, lines, prefix + ast.indent);
        }
    }
}

function jsStatement(n: XjsJsStatement, lines: string[], prefix: string) {
    lines.push(`${prefix}#jsStatement`);
    jsCode(n.code, lines, prefix + ast.indent);
}

function jsBlock(n: XjsJsBlock, lines: string[], prefix: string) {
    let args = "";
    if (n.args) {
        args = " [" + n.args.join(", ") + "]";
    }
    lines.push(`${prefix}#jsBlock${args}`);

    jsCode(n.startCode, lines, prefix + ast.indent);
    if (n.content) {
        for (let c of n.content) {
            serialize(c, lines, prefix + ast.indent + ast.indent);
        }
    }
    jsCode(n.endCode, lines, prefix + ast.indent);
}

function jsCode(code: string, lines: string[], prefix: string) {
    let codeLines = code.split("\n"), s = "", idx = 0, indent = 0, ws = "";
    for (let ln of codeLines) {
        // first line will always have 0 indent as spaces are eaten by the parser

        if (idx > 0) {
            ws = ln.match(/^\s*/g)![0];
            if (idx === 1) {
                indent = ws.length;
            } else if (ws.length < indent) {
                indent = ws.length;
            }
        }
        lines.push(prefix + ln.slice(indent));
        idx++;
    }
}

function textNode(n: XjsText, lines: string[], prefix: string) {
    if (n.expressions && n.expressions.length) {
        let idx = 0;
        lines.push(`${prefix}#textNode`);
        do {
            lines.push(`${prefix + ast.indent}"${n.textFragments[idx]}"`);
            if (idx < n.expressions.length) {
                serialize(n.expressions[idx], lines, prefix + ast.indent);
            }
            idx++;
        } while (idx < n.textFragments.length);
    } else {
        lines.push(`${prefix}#textNode "${n.textFragments[0]}"`);
    }
}

function expression(n: XjsExpression, lines: string[], prefix: string) {
    if (n.refPath !== U) {
        lines.push(`${prefix}#expression {#${n.refPath.join(".")}}`);
    } else {
        lines.push(`${prefix}#expression {${n.oneTime ? "::" : ""}${n.code}}`);
    }
}

function params(n: XjsParamHost, prefix = "", suffix = ""): string {
    if (n.params === U) return "";
    const res: string[] = [];

    for (let p of n.params) {
        if (p.kind === "#label") {
            const lbl = p;
            if (!lbl.isOrphan) {
                res.push(`#${lbl.fwdLabel ? "#" : ""}${lbl.name}=${getParamValue(lbl.value)}`);
            } else {
                res.push(`#${lbl.fwdLabel ? "#" : ""}${lbl.name}`);
            }
        } else if (p.kind === "#param") {
            // if (p.isSpread) {
            //     buffer.push(`{...${(p.value as XjsExpression).code}}`);
            // } else
            if (p.isOrphan) {
                res.push(p.name);
            } else {
                res.push(`${p.name}=${getParamValue(p.value)}`);
            }
        } else if (p.kind === "#property") {
            // if (prop.isSpread) {
            //     buffer.push(`{...[${(prop.value as XjsExpression).code}]}`);
            // } else {
            res.push(`[${p.name}]=${getParamValue(p.value)}`);
            // }
        } else if (p.kind === "#decorator") {
            const d = p, noRef = (d.ref.refPath === U) ? "NO-REF" : "";
            if (d.isOrphan) {
                res.push(`@${d.ref.code}${noRef}`);
            } else if (d.hasDefaultPropValue) {
                res.push(`@${d.ref.code}${noRef}=${getParamValue(d.defaultPropValue)}`);
            } else {
                res.push(`@${d.ref.code}${noRef}(${params(d)})`);
            }
        } else if (p.kind === "#decoratorNode") {
            res.push(`node:@${p.ref.code}`);
            // add the node as content
            const host = n as XjsContentHost;
            if (!host.content) {
                host.content = [p];
            } else {
                host.content.splice(0, 0, p);
            }
            p.ref.code += "[utils]"; // change name to know this node is coming from the utils
        }
        // todo: decorator node
    }
    return res.length ? prefix + res.join(" ") + suffix : "";
}

function fragment(n: XjsFragment | XjsCData, lines: string[], prefix: string) {
    let nm = "!";
    if (n.kind === "#component") {
        nm = "*" + n["ref"].code;
        if (!n["ref"].refPath) nm += "NO-REF";
    } else if (n.kind === "#element" || n.kind === "#paramNode") {
        let exp = n["nameExpression"] as XjsExpression;
        if (exp) {
            nm = `{${exp.oneTime ? "::" : ""}${exp.code}}`;
        } else {
            nm = n["name"];
        }
    } else if (n.kind === "#decoratorNode") {
        nm = "@" + n["ref"].code;
        if (!n["ref"].refPath) nm += "NO-REF";
    }
    if (n.kind === "#paramNode") {
        nm = "." + nm;
    }
    if (n.kind === "#cdata") {
        lines.push(`${prefix}${n.kind} <!cdata${params(n, " ")}${n.text ? "" : "/"}>`);
        if (n.text) {
            lines.push(n.text);
        }
    } else {
        lines.push(`${prefix}${n.kind} <${nm}${params(n, " ")}${n.content ? "" : "/"}>`);

        if (n.content) {
            for (let c of n.content) {
                serialize(c, lines, prefix + ast.indent);
            }
        }
    }
}

function getParamValue(value: any) {
    switch (typeof value) {
        case "boolean":
        case "number":
            return "" + value;
        case "string":
            return '"' + value + '"';
        case "object":
            let exp = value as XjsExpression;
            if (exp.refPath) {
                return '{#' + exp.refPath.join(".") + '}';
            } else {
                return '{' + (exp.oneTime ? "::" : "") + (exp.isBinding ? "2b:" : "") + exp.code + '}';
            }
    }
    return "INVALID";
}
