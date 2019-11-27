import { XdfParserContext, parse } from './parser';
import { XdfParamHost, XdfPreProcessorCtxt, XdfParamDictionary, XdfFragment } from './ast';

const U = undefined,
    RX_TARGET = /^(\.?[\?a-zA-Z_]\w*)+(\.|\[\]\.?)?$/,
    RX_EXPORT = /^[\?a-zA-Z_]\w*$/,
    RX_ARRAY_TARGET = /\[\](\.)?$/;

export function stringify(xdf: string, context?: XdfParserContext): string {
    return processXdf(xdf, "string", context) as string;
}

export function json(xdf: string, context?: XdfParserContext): Object {
    return processXdf(xdf, "object", context) as Object;
}

function processXdf(xdf: string, output: "object" | "string", context?: XdfParserContext): Object | string {
    if (xdf === "") return {};
    let outputPrefix = "", outputSuffix = "";

    context = context || {};
    if (context.preProcessors === U) {
        context.preProcessors = { "@@json": json }
    } else {
        context.preProcessors["@@json"] = json;
    }
    if (context.globalPreProcessors === U) {
        context.globalPreProcessors = [];
    }
    context.globalPreProcessors.push("@@json");

    const jsonRoot = {};

    const stack: { holder: Object | Array<any>, propName: string, isArray: boolean, target: string, pos: number }[] = [];

    parse(xdf, context);

    // return object or string depending on output argument
    if (output === "object") {
        return jsonRoot;
    } else {
        return outputPrefix + JSON.stringify(jsonRoot) + outputSuffix;
    }

    function json() {

        function isRootNode(target: XdfParamHost, root: XdfFragment) {
            return (target === root) || (root.children.length === 1 && target === root.children[0]);
        }

        return {
            setup(target: XdfParamHost, params: XdfParamDictionary, ctxt: XdfPreProcessorCtxt) {
                let pTarget: string | null = null;
                if (params.value !== U) {
                    pTarget = params.value.value || null;
                } else if (params.target !== U) {
                    pTarget = params.target.value || null;
                }

                if (pTarget !== null) {
                    const r = pTarget.match(RX_TARGET), pos = params.value ? params.value.pos : params.target!.pos;
                    if (r === null) {
                        ctxt.error("Invalid target value '" + pTarget + "'", pos);
                    }
                    const isArrayTarget = (pTarget.match(RX_ARRAY_TARGET) !== null);
                    let isArrayItem = false;
                    if (isArrayTarget) {
                        if (RegExp.$1 === '.') {
                            pTarget = pTarget.slice(0, -3); // remove '[].'
                            isArrayItem = true;
                        } else {
                            pTarget = pTarget.slice(0, -2); // remove '[]'
                        }
                    }
                    const path = pTarget.split(".")
                    let ref = jsonRoot, startIdx = 0, p = "";

                    if (path[0] === "") {
                        // relative path: .foo.bar
                        startIdx = 1;
                        if (stack.length > 0) {
                            let previousCtxt = stack[stack.length - 1];
                            if (previousCtxt.isArray) {
                                ctxt.error("Relative paths ('" + pTarget + "') cannot be used in array string items", pos);
                            } else {
                                ref = stack[stack.length - 1].holder;
                            }
                        }
                    }
                    let contentName = "content";
                    for (let i = startIdx; path.length > i; i++) {
                        p = path[i];
                        if (i === path.length - 1) {
                            if (isArrayTarget) {
                                contentName = "";
                                if (ref[p] === U) {
                                    ref = ref[p] = [];
                                } else {
                                    ref = ref[p];
                                }
                                if (isArrayItem) {
                                    const item = {};
                                    (ref as Array<any>).push(item);
                                    ref = item;
                                }
                            } else if (p !== "") {
                                contentName = p;
                            }
                        } else {
                            if (ref[p] === U) {
                                ref = ref[p] = {}
                            } else {
                                ref = ref[p];
                            }
                        }
                    }

                    stack.push({ holder: ref, propName: contentName, isArray: isArrayTarget && !isArrayItem, target: pTarget, pos: pos })
                } else if (target === ctxt.rootFragment) {
                    // pTarget = "content";
                    let len = stack.length;
                    if (len === 0) {
                        stack[0] = { holder: jsonRoot, propName: "content", isArray: false, target: "content", pos: 0 };
                    } else {
                        let current = stack[stack.length - 1];
                        if (current.propName === "content") {
                            stack.push(current);
                        } else {
                            stack.push({ holder: jsonRoot, propName: "content", isArray: false, target: "content", pos: 0 });
                        }
                    }
                }
            },

            process(target: XdfParamHost, params: XdfParamDictionary, ctxt: XdfPreProcessorCtxt) {
                // 2 possible params: export and target(default)
                // target: path that defines where to store the string corresponding to this node - e.g. "a.b.c."
                // export: 

                const pExport = params.export ? params.export.value || "" : "",
                    kind = target.kind,
                    isFirst = isRootNode(target, ctxt.rootFragment);

                if (pExport !== "") {
                    const pos = params.export!.pos;
                    if (!isFirst) {
                        ctxt.error("'export' can only be used on root container", pos);
                    } else {
                        if (pExport.match(RX_EXPORT) === null) {
                            ctxt.error("Invalid export value: '" + pExport + "'", pos);
                        }
                        if (pExport === "default") {
                            // e.g. export default {...};
                            outputPrefix = "export default ";
                        } else {
                            // e.g. export const foo = {...};
                            outputPrefix = "export const " + pExport + "=";
                        }
                        outputSuffix = ";";
                    }
                }

                let content = "";
                if (kind === "#element" || kind === "#fragment" || kind === "#component") {
                    content = target.toString("", "", true).trim();
                    // remove target from its parent so that it is not serialized twice
                    removeTargetFromParent(target, ctxt.parent, ctxt.rootFragment);
                } else if (kind === "#cdata") {
                    content = target.toString("", "");
                    removeTargetFromParent(target, ctxt.parent, ctxt.rootFragment);
                } else {
                    ctxt.error("Pre-processor cannot be used in " + kind, target.pos);
                }

                const jsonCtxt = stack.pop()!;
                if (content !== "") {
                    if (jsonCtxt.isArray) {
                        (jsonCtxt.holder as Array<any>).push(content);
                    } else {
                        const val = jsonCtxt.holder[jsonCtxt.propName];
                        if (val === "" || val === U) {
                            jsonCtxt.holder[jsonCtxt.propName] = content;
                        } else {
                            ctxt.error("Value cannot be set twice in '" + jsonCtxt.target + "'", jsonCtxt.pos);
                        }
                    }
                }
            }
        }
    }

    function removeTargetFromParent(target: XdfParamHost, parent: XdfParamHost | null, root: XdfFragment) {
        if (target !== root && parent !== null) {
            if (parent.kind === "#element" || parent.kind === "#fragment" || parent.kind === "#component") {
                let idx = parent.children!.indexOf(target as any);
                if (idx > -1) {
                    parent.children!.splice(idx, 1);
                }
            }
        }
    }
}
