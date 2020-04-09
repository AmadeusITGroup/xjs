
/**
 * This node script generates the xjs.tmLanguage.json file from the TypeScript.tmLanguage.json in the syntaxes folder
 * 
 * To generate a new grammar version:
 * - update the syntaxes/TypeScript.tmLanguage.json file from
 *   https://github.com/Microsoft/vscode/blob/master/extensions/typescript-basics/syntaxes/TypeScript.tmLanguage.json
 * - and run this script: yarn build
 */

import * as path from 'path';
import * as fs from 'fs';

// warning: __dirname is in the dist folder!
const TS_GRAMMAR_PATH = "../../syntaxes/TypeScript.tmLanguage.json",
    XJS_GRAMMAR_PATH = "../../syntaxes/xjs.tmLanguage.json",
    // XJS_GRAMMAR_TS_PATH = "../../src/xjs/tm-grammar.ts",
    fsp = fs.promises,
    NO_BANG = "(?<!\\!)"; // negative look behind to escape some chars - e.g. !<

main();

async function main() {
    let content = await fsp.readFile(path.join(__dirname, TS_GRAMMAR_PATH));

    let g = JSON.parse(content.toString());

    // update file
    g["information_for_contributors"] = "File generated by xjs/xjs-grammar";

    includeTemplateDef(g, "xjs");
    includeTemplateDef(g, "xtc");

    // copy node attributes patterns to decorator attributes patterns
    let xjsAttributePatterns = g.repository["xjs-tag-open"].patterns;
    g.repository["xjs-tag-attribute-decorator-with-attributes"].patterns = xjsAttributePatterns.slice(0); // clone

    let xtcAttributePatterns = g.repository["xtc-tag-open"].patterns;
    g.repository["xtc-tag-attribute-decorator-with-attributes"].patterns = xtcAttributePatterns.slice(0);

    // save the new grammar
    const xjsFile = await fsp.open(path.join(__dirname, XJS_GRAMMAR_PATH), "w");
    const newContent = JSON.stringify(g, undefined, "\t");
    await fsp.writeFile(xjsFile, newContent);

    // const xjsFile2 = await fsp.open(path.join(__dirname, XJS_GRAMMAR_TS_PATH), "w");
    // const newContent2 = JSON.stringify(g);
    // await fsp.writeFile(xjsFile2, "export default `" + newContent2.replace(/\\/g, "\\\\").replace(/\`/g, "\\`") + "`;", 'utf8');
}

function addToRepository(g: any, name: string, json: any) {
    g.repository[name] = json;
}

function addStatement(g: any, prefix: "xjs" | "xtc", name: string, json: any) {
    g.repository[name] = json;
    g.repository[prefix + "-statements"].patterns.splice(0, 0, {
        "include": "#" + name
    });
}

function includeTemplateDef(g: any, prefix: "xjs" | "xtc") {
    // (?<=x) = positive lookbehind - cf. https://www.regular-expressions.info/lookaround.html

    if (prefix === "xjs") {
        g.repository.template.patterns.splice(0, 0, {
            "name": prefix + ".template.ts",
            "begin": "(([a-zA-Z]+\\.)?\\$template)\\s*(`)", // xxx.$template or $template
            "beginCaptures": {
                "1": { "name": "entity.name.function.ts" },
                "2": { "name": "punctuation.definition.template.begin.xjs" }
            },
            "end": "`",
            "endCaptures": {
                "0": { "name": "punctuation.definition.template.end.xjs" }
            },
            "patterns": [
                { "include": "#" + prefix + "-template-function" }
            ]
        });
    } else {
        g.repository.template.patterns.splice(0, 0, {
            "name": prefix + ".template.ts",
            "begin": "(([a-zA-Z]+\\.)?\\$content)\\s*(`)",
            "beginCaptures": {
                "1": { "name": "entity.name.function.ts" },
                "2": { "name": "punctuation.definition.template.begin.xjs" }
            },
            "end": "`",
            "endCaptures": {
                "0": { "name": "punctuation.definition.template.end.xjs" }
            },
            "patterns": [
                { "include": "#" + prefix + "-statements" }
            ]
        });
    }
    includeXTplFunctions(g, prefix);
    includeXStatements(g, prefix);
}

function includeXTplFunctions(g: any, prefix: "xjs" | "xtc") {
    addToRepository(g, prefix + "-template-function", {
        "name": "template.function.xjs",
        "patterns": [
            {
                "match": "(?:(?<![_$[:alnum:]])(?:(?<=\\.\\.\\.)|(?<!\\.))(\\basync)\\s+)?([_$[:alpha:]][_$[:alnum:]]*)\\s*(?==>)",
                "captures": {
                    "1": { "name": "storage.modifier.async.ts" },
                    "2": { "name": "variable.parameter.ts" }
                }
            },
            {
                "begin": "(?x) (?:\n  (?<![_$[:alnum:]])(?:(?<=\\.\\.\\.)|(?<!\\.))(\\basync)\n)? ((?<![})!\\]])\\s*\n  (?=\n    # sure shot arrow functions even if => is on new line\n(\n  (<\\s*([_$[:alpha:]]|(\\{([^\\{\\}]|(\\{[^\\{\\}]*\\}))*\\})|(\\(([^\\(\\)]|(\\([^\\(\\)]*\\)))*\\))|(\\[([^\\[\\]]|(\\[[^\\[\\]]*\\]))*\\]))([^=<>]|=[^<]|\\<\\s*([_$[:alpha:]]|(\\{([^\\{\\}]|(\\{[^\\{\\}]*\\}))*\\})|(\\(([^\\(\\)]|(\\([^\\(\\)]*\\)))*\\))|(\\[([^\\[\\]]|(\\[[^\\[\\]]*\\]))*\\]))([^=<>]|=[^<]|\\<\\s*([_$[:alpha:]]|(\\{([^\\{\\}]|(\\{[^\\{\\}]*\\}))*\\})|(\\(([^\\(\\)]|(\\([^\\(\\)]*\\)))*\\))|(\\[([^\\[\\]]|(\\[[^\\[\\]]*\\]))*\\]))([^=<>]|=[^<])*\\>)*\\>)*>\\s*)?\n  [(]\\s*(\\/\\*([^\\*]|(\\*[^\\/]))*\\*\\/\\s*)*\n  (\n    ([)]\\s*:) |                                                                                       # ():\n    ((\\.\\.\\.\\s*)?[_$[:alpha:]][_$[:alnum:]]*\\s*:)                                                                  # [(]param: | [(]...param:\n  )\n) |\n\n# arrow function possible to detect only with => on same line\n(\n  (<\\s*([_$[:alpha:]]|(\\{([^\\{\\}]|(\\{[^\\{\\}]*\\}))*\\})|(\\(([^\\(\\)]|(\\([^\\(\\)]*\\)))*\\))|(\\[([^\\[\\]]|(\\[[^\\[\\]]*\\]))*\\]))([^=<>]|=[^<]|\\<\\s*([_$[:alpha:]]|(\\{([^\\{\\}]|(\\{[^\\{\\}]*\\}))*\\})|(\\(([^\\(\\)]|(\\([^\\(\\)]*\\)))*\\))|(\\[([^\\[\\]]|(\\[[^\\[\\]]*\\]))*\\]))([^=<>]|=[^<]|\\<\\s*([_$[:alpha:]]|(\\{([^\\{\\}]|(\\{[^\\{\\}]*\\}))*\\})|(\\(([^\\(\\)]|(\\([^\\(\\)]*\\)))*\\))|(\\[([^\\[\\]]|(\\[[^\\[\\]]*\\]))*\\]))([^=<>]|=[^<])*\\>)*\\>)*>\\s*)?                                                                                 # typeparameters\n  \\(\\s*(\\/\\*([^\\*]|(\\*[^\\/]))*\\*\\/\\s*)*(([_$[:alpha:]]|(\\{([^\\{\\}]|(\\{[^\\{\\}]*\\}))*\\})|(\\[([^\\[\\]]|(\\[[^\\[\\]]*\\]))*\\])|(\\.\\.\\.\\s*[_$[:alpha:]]))([^()\\'\\\"\\`]|(\\(([^\\(\\)]|(\\([^\\(\\)]*\\)))*\\))|(\\'([^\\'\\\\]|\\\\.)*\\')|(\\\"([^\\\"\\\\]|\\\\.)*\\\")|(\\`([^\\`\\\\]|\\\\.)*\\`))*)?\\)   # parameters\n  (\\s*:\\s*([^<>\\(\\)\\{\\}]|\\<([^<>]|\\<[^<>]+\\>)+\\>|\\([^\\(\\)]+\\)|\\{[^\\{\\}]+\\})+)?                                                                        # return type\n  \\s*=>                                                                                               # arrow operator\n)\n  )\n)",
                "beginCaptures": {
                    "1": { "name": "storage.modifier.async.ts" }
                },
                "end": "(?==>|\\{|(^\\s*(export|function|class|interface|let|var|const|import|enum|namespace|module|type|abstract|declare)\\s+))",
                "patterns": [
                    { "include": "#comment" },
                    { "include": "#type-parameters" },
                    { "include": "#function-parameters" }
                    // arrow return type doesn't make sense in this case
                    // {
                    //     "include": "#arrow-return-type"
                    // },
                    // {
                    //     "include": "#possibly-arrow-return-type"
                    // }
                ]
            },
            {
                "begin": "=>",
                "beginCaptures": {
                    "0": { "name": "storage.type.function.arrow.ts" }
                },
                "end": "((?<=\\}|\\S)(?<!=>)|((?!\\{)(?=\\S)))(?!\\/[\\/\\*])",
                "patterns": [
                    { "include": "#" + prefix + "-decl-block" }
                ]
            }
        ]
    });
}

function includeXStatements(g: any, prefix: "xjs" | "xtc") {
    addToRepository(g, prefix + "-statements", {
        "patterns": [
            // other patterns will be included - cf. addStatement
            { "include": "#comment" },
            { "include": "#string-character-escape" },
            { "include": "#xjs-character-escape" }
        ]
    });

    if (prefix === "xtc") {
        g.repository["xtc-statements"].patterns.splice(0, 0, {
            "include": "#template-substitution-element" // to support ${exp}
        });
    }

    addToRepository(g, prefix + "-decl-block", {
        "name": "meta.block.ts",
        "begin": "\\{",
        "beginCaptures": {
            "0": {
                "name": "punctuation.section.embedded.block.xjs"
            }
        },
        "end": NO_BANG + "\\}",
        "endCaptures": {
            "0": {
                "name": "punctuation.section.embedded.block.xjs"
            }
        },
        "patterns": [
            { "include": "#" + prefix + "-statements" }
        ]
    });

    if (prefix === "xjs") {
        // common: only need to be added once
        // escape chars: !{ !} !< !> !s !! !n !$ !_ !z
        g.repository["xjs-character-escape"] = {
            "name": "constant.character.escape.ts",
            "match": "\\!(\\<|\\>|\\{|\\}|\\!|\\$|n|s|z|_|\\/)"
        };
    }
    includeXText(g, prefix);
    includeXTag(g, prefix);
    includeXCData(g, prefix);
    includeXJsStatements(g, prefix);
}

function includeXText(g: any, prefix: "xjs" | "xtc") {
    addStatement(g, prefix, prefix + "-text-expression", {
        "name": "meta.block.ts",
        "begin": "(" + NO_BANG + "\\{)",
        "beginCaptures": {
            "1": {
                "name": "punctuation.section.embedded.text.expr.xjs"
            }
        },
        "end": "\\}",
        "endCaptures": {
            "0": {
                "name": "punctuation.section.embedded.text.expr.xjs"
            }
        },
        "patterns": [
            {
                "include": "#expression"
            }
        ]
    });
}

function includeXTag(g: any, prefix: "xjs" | "xtc") {

    addStatement(g, prefix, prefix + "-tag-open", {
        "name": "meta.tag.js.xjs",
        "begin": "(" + NO_BANG + "<(?![/\\s\\d]))(\\!|((\\@|\\.|\\*)?[a-zA-Z][\\w\\-\\.]*))",
        "beginCaptures": {
            "1": { "name": "punctuation.definition.tag.begin.js.xjs" },
            "2": { "name": "entity.name.tag.js.xjs" }
        },
        "end": "(\\/?)(\\>)",
        "endCaptures": {
            "1": { "name": "punctuation.definition.tag.close.js.xjs" },
            "2": { "name": "punctuation.definition.tag.end.js.xjs" }
        },
        "patterns": [
            { "include": "#" + prefix + "-attributes" }
        ]
    });

    includeXAttributes(g, prefix);

    addStatement(g, prefix, prefix + "-tag-close", {
        "name": "meta.tag.js.xjs",
        "begin": "(" + NO_BANG + "<)(/)(\\!|((\\@|\\.|\\*)?[a-zA-Z][\\w\\-\\.]*))?",
        "beginCaptures": {
            "1": { "name": "punctuation.definition.tag.begin.js.xjs" },
            "2": { "name": "punctuation.definition.tag.close.js.xjs" },
            "3": { "name": "entity.name.tag.js.xjs" }
        },
        "end": ">",
        "endCaptures": {
            "0": { "name": "punctuation.definition.tag.end.js.xjs" }
        }
    });
}

function includeXAttributes(g: any, prefix: "xjs" | "xtc") {
    if (prefix === "xtc") {
        g.repository["xtc-ref"] = {
            "name": "variable.other.readwrite.ts",
            "match": "[_$[:alpha:]][_$[:alnum:]]*"
        };

        g.repository["xtc-expression-ref"] = {
            "name": "entity.other.attribute.reference.xtc",
            "begin": "(?!\\\\)(\\{)((\\:\\:)|(\\=))?",
            "beginCaptures": {
                "1": {
                    "name": "punctuation.section.embedded.begin.xjs"
                },
                "2": {
                    "name": "punctuation.section.embedded.modifier.xjs"
                }
            },
            "end": "\\}",
            "endCaptures": {
                "0": {
                    "name": "punctuation.section.embedded.end.xjs"
                }
            },
            "patterns": [
                { "include": "#xtc-expression" }
            ]
        };

        g.repository["xtc-expression"] = {
            "patterns": [
                { "include": "#numeric-literal" },
                { "include": "#boolean-literal" },
                { "include": "#string" },
                { "include": "#xtc-ref" },
                { "include": "#punctuation-accessor" }
            ]
        }
    }


    g.repository[prefix + "-attributes"] = {
        "patterns": [
            // { "include": "#template-substitution-element" }, // e.g. ${expression()}
            { "include": "#comment" },
            { "include": "#" + prefix + "-tag-attribute-label" },
            { "include": "#" + prefix + "-tag-attribute-label-no-expr" },
            { "include": "#" + prefix + "-tag-attribute-decorator" },
            { "include": "#" + prefix + "-tag-attribute-decorator-with-attributes" },
            { "include": "#" + prefix + "-tag-attribute-decorator-no-values" },
            { "include": "#" + prefix + "-tag-attribute-binding-property" },
            { "include": "#" + prefix + "-tag-attribute-binding-param" },
            { "include": "#" + prefix + "-tag-property" },
            { "include": "#" + prefix + "-tag-attribute" },
            { "include": "#" + prefix + "-tag-attribute-no-values" }
        ]
    };

    if (prefix === "xtc") {
        g.repository["xtc-attributes-values"] = {
            "name": "entity.other.attribute.value",
            "patterns": [
                // { "include": "#template-substitution-element" },
                { "include": "#numeric-literal" },
                { "include": "#boolean-literal" },
                { "include": "#string" },
                { "include": "#xtc-expression-ref" }
            ]
        };
    } else {
        // xjs
        g.repository["xjs-attributes-values"] = {
            "name": "entity.other.attribute.value",
            "patterns": [
                { "include": "#numeric-literal" },
                { "include": "#boolean-literal" },
                { "include": "#string" },
                { "include": "#xjs-expression-function-block" },
                { "include": "#xjs-expression-block" }
            ]
        };
        includeXjsExpressionBlock(g);
    }

    includeLabelAttributes(g, prefix);
    includeDecoratorAttributes(g, prefix);
    includeStandardAttributes(g, prefix);
    includeBindingShortcuts(g, prefix);
}

function attributeSeparator() {
    return "(?<= |\\(|^|\<)";
}

function attributeName(withDots = false, withDashes = false) {
    if (withDashes) {
        return withDots ? "[\\$\\w][\\w\\-\\.]*" : "[\\$\\w][\\w\\-]*"
    }
    return withDots ? "[\\$\\w][\\w\\.]*" : "[\\$\\w]\\w*"
}

function includeXjsExpressionBlock(g: any) {
    // e.g. {=>doSomething();doSomethingElse()}
    g.repository["xjs-expression-function-block"] = {
        "name": "meta.block.ts",
        "begin": "(?!\\\\)(\\{)(\\=\\>)",
        "beginCaptures": {
            "1": { "name": "punctuation.section.embedded.begin.js.xjs" },
            "2": { "name": "punctuation.section.embedded.modifier.js.xjs" }
        },
        "end": "\\}",
        "endCaptures": {
            "0": { "name": "punctuation.section.embedded.end.js.xjs" }
        },
        "patterns": [
            { "include": "#decl-block" },
            { "include": "#expression" }
        ]
    }

    // e.g. {foo()} or {::bar()} or {=a.b.c}
    g.repository["xjs-expression-block"] = {
        "name": "meta.block.ts",
        "begin": "(?!\\\\)(\\{)((\\:\\:)|(\\=))?",
        "beginCaptures": {
            "1": { "name": "punctuation.section.embedded.begin.js.xjs" },
            "2": { "name": "punctuation.section.embedded.modifier.js.xjs" }
        },
        "end": "\\}",
        "endCaptures": {
            "0": { "name": "punctuation.section.embedded.end.js.xjs" }
        },
        "patterns": [
            { "include": "#expression" }
        ]
    }
}

function includeStandardAttributes(g: any, prefix: "xjs" | "xtc", includeProperties = true) {
    // attribute with value - e.g. <span foo={a*2+123} aria-label="abc" />
    if (includeProperties) {
        // property attribute - e.g. <div [foo]=123 [baz]={expr()} />
        addToRepository(g, prefix + "-tag-property", {
            "name": "tag.attribute.property.assignment",
            "begin": "(" + attributeSeparator() + "\\[)(" + attributeName() + ")(\\])\\s*(=)\\s*",
            "beginCaptures": {
                "1": { "name": "punctuation.section.embedded.property.begin.js.xjs" },
                "2": { "name": "entity.other.attribute-name.js.xjs" },
                "3": { "name": "punctuation.section.embedded.property.end.js.xjs" },
                "4": { "name": "keyword.operator.assignment.js.xjs" }
            },
            "end": " |(?=>)|(?=/)|(?=\\))",
            "patterns": [
                { "include": "#" + prefix + "-attributes-values" }
            ]
        });
    }

    addToRepository(g, prefix + "-tag-attribute", {
        "name": "tag.attribute.assignment",
        "begin": "\\s*(" + attributeSeparator() + attributeName(false, true) + ")\\s*(=)\\s*",
        "beginCaptures": {
            "1": { "name": "entity.other.attribute-name.js.xjs" },
            "2": { "name": "keyword.operator.assignment.js.xjs" }
        },
        "end": " |(?=>)|(?=/)|(?=\\))",
        "patterns": [
            { "include": "#" + prefix + "-attributes-values" }
        ]
    });

    // no values attribute - e.g. <div disabled/>
    addToRepository(g, prefix + "-tag-attribute-no-values", {
        "name": "tag.attribute",
        "match": "\\s*(" + attributeSeparator() + attributeName(false, true) + ")(?=(\\s|/|>|\\)))", // no need to support . notation
        "captures": {
            "1": { "name": "entity.other.attribute-name.js.xjs" }
        }
    });
}

function includeDecoratorAttributes(g: any, prefix: "xjs" | "xtc") {
    // decorator with value - e.g. @class="foo"
    addToRepository(g, prefix + "-tag-attribute-decorator", {
        "name": "tag.attribute.decorator.assignment",
        "begin": "\\s*(" + attributeSeparator() + "\\@{1,2})(" + attributeName(true) + ")\\s*(\\=)\\s*",
        "beginCaptures": {
            "1": { "name": "punctuation.section.embedded.decorator.js.xjs" },
            "2": { "name": "entity.other.attribute-name.js.xjs" },
            "3": { "name": "keyword.operator.assignment.js.xjs" }
        },
        "end": " |(?=>)|(?=/)|(?=\\))",
        "patterns": [
            { "include": "#" + prefix + "-attributes-values" }
        ]
    });

    // decorator with its own attributes
    addToRepository(g, prefix + "-tag-attribute-decorator-with-attributes", {
        "name": "tag.attribute.decorator.assignment",
        "begin": "\\s*(" + attributeSeparator() + "\\@{1,2})(" + attributeName(true) + ")\\s*(\\()\\s*",
        "beginCaptures": {
            "1": { "name": "punctuation.section.embedded.decorator.js.xjs" },
            "2": { "name": "entity.other.attribute-name.js.xjs" },
            "3": { "name": "punctuation.section.embedded.decorator.begin.js.xjs" }
        },
        "end": "(\\))",
        "endCaptures": {
            "0": { "name": "punctuation.section.embedded.decorator.end.js.xjs" }
        },
        "patterns": [] // will be copied from "xjs-tag-open" or "xtc-tag-open"
    });

    // decorator with no values - e.g. @host
    addToRepository(g, prefix + "-tag-attribute-decorator-no-values", {
        "name": "entity.other.attribute.decorator.js.xjs",
        "match": "\\s*" + attributeSeparator() + "(\\@{1,2})(" + attributeName(true) + ")(?=(\\s|/|>|\\)))",
        "captures": {
            "1": { "name": "punctuation.section.embedded.decorator.js.xjs" },
            "2": { "name": "entity.other.attribute-name.js.xjs" }
        }
    });
}

function includeLabelAttributes(g: any, prefix: "xjs" | "xtc") {
    // label attributes w/ expression - e.g. #foo={bar()}
    addToRepository(g, prefix + "-tag-attribute-label", {
        "name": "entity.other.attribute.label.js.xjs",
        "begin": "\\s*(" + attributeSeparator() + "\\#\\#?)(" + attributeName(true) + ")\\s*(\\=)\\s*",
        "beginCaptures": {
            "1": { "name": "punctuation.section.embedded.label.js.xjs" },
            "2": { "name": "entity.other.attribute-name.js.xjs" },
            "3": { "name": "keyword.operator.assignment.js.xjs" }
        },
        "end": " |(?=>)|(?=/)|(?=\\))",
        "patterns": [
            { "include": "#" + prefix + "-attributes-values" }
        ]
    });

    // label attribute w/o expressions - e.g. <div #foo #bar/>
    addToRepository(g, prefix + "-tag-attribute-label-no-expr", {
        "name": "entity.other.attribute.label.js.xjs",
        "match": "\\s*" + attributeSeparator() + "(\\#\\#?)(" + attributeName() + ")",
        "captures": {
            "1": { "name": "punctuation.section.embedded.label.js.xjs" },
            "2": { "name": "entity.other.attribute-name.js.xjs" }
        }
    });
}

function includeBindingShortcuts(g: any, prefix: "xjs" | "xtc") {
    // e.g. {[name]} or {::[name]}
    addToRepository(g, prefix + "-tag-attribute-binding-property", {
        "name": "entity.other.attribute.property.shortcut.js.xjs",
        "match": "\\s*" + attributeSeparator() + "(\\{)(\\:\\:)?(\\[)\\s*(" + attributeName() + ")\\s*(\\]})",
        "captures": {
            "1": { "name": "punctuation.section.embedded.begin.js.xjs" },
            "2": { "name": "punctuation.section.embedded.modifier.js.xjs" },
            "3": { "name": "punctuation.section.embedded.property.begin.js.xjs" },
            "4": { "name": "variable.other.readwrite.ts" },
            "5": { "name": "punctuation.section.embedded.end.js.xjs" }
        }
    });

    // e.g. {name} or {::name}
    addToRepository(g, prefix + "-tag-attribute-binding-param", {
        "name": "entity.other.attribute.param.shortcut.js.xjs",
        "match": "\\s*" + attributeSeparator() + "(\\{)(\\:\\:)?\\s*(" + attributeName() + ")\\s*(\\})",
        "captures": {
            "1": { "name": "punctuation.section.embedded.begin.js.xjs" },
            "2": { "name": "punctuation.section.embedded.modifier.js.xjs" },
            "3": { "name": "variable.other.readwrite.ts" },
            "4": { "name": "punctuation.section.embedded.end.js.xjs" }
        }
    });
}

function includeXCData(g: any, prefix: "xjs" | "xtc") {
    addStatement(g, prefix, prefix + "-cdata", {
        "name": "meta.tag.js.xjs",
        "begin": "(" + NO_BANG + "<)(\\!cdata)",
        "beginCaptures": {
            "1": {
                "name": "punctuation.definition.tag.begin.js.xjs"
            },
            "2": {
                "name": "entity.name.tag.js.xjs"
            }
        },
        "end": "(<\\/)(\\!cdata)(>)",
        "endCaptures": {
            "1": {
                "name": "punctuation.definition.tag.begin.js.xjs"
            },
            "2": {
                "name": "entity.name.tag.js.xjs"
            },
            "3": {
                "name": "punctuation.definition.tag.end.js.xjs"
            }
        },
        "patterns": [
            {
                "include": "#" + prefix + "-attributes"
            },
            {
                "include": "#" + prefix + "-cdata-content"
            }
        ]
    });

    g.repository[prefix + "-cdata-content"] = {
        "name": "cdata.content.xjs",
        "begin": "\\s*(>)",
        "beginCaptures": {
            "1": {
                "name": "punctuation.definition.tag.end.js.xjs"
            }
        },
        "end": "(?=</\\!cdata>)",
        "patterns": [
            {
                "include": "#" + prefix + "-cdata-string"
            },
            {
                "include": "#" + prefix + "-cdata-string-end"
            }
        ]
    };

    g.repository[prefix + "-cdata-string"] = {
        "name": "cdata.content.xjs", // can also use string.cdata.content.xjs to get 'string' highlighting
        "match": "((\\!</\\!cdata>)|(.(?!</\\!cdata>)))+"
    };

    g.repository[prefix + "-cdata-string-end"] = {
        "name": "cdata.content.xjs",
        "match": ".(?=</\\!cdata>)"
    };
}

function includeXJsStatements(g: any, prefix: "xjs" | "xtc") {

    const expression = (prefix === "xjs") ? "#expression" : "#xtc-expression";


    // $if statement
    addStatement(g, prefix, prefix + "-if-statement", {
        "patterns": [{
            // adapted from typescript tm grammar
            "name": "if.statement.xjs",
            "begin": "(?=\\$if\\s)",
            "end": "(?<=\\})(?!(\\s*else))",
            "patterns": [
                { "include": "#comment" }, {
                    // condition part: $if ( or else if (
                    "begin": "(\\$if|\\s*else\\s+if)\\s*(\\()",
                    "beginCaptures": {
                        "1": { "name": "keyword.control.conditional.xjs" },
                        "2": { "name": "meta.brace.round.ts" }
                    },
                    "end": "\\)",
                    "endCaptures": {
                        "0": { "name": "meta.brace.round.ts" }
                    },
                    "patterns": [
                        { "include": expression }
                    ]
                }, {
                    // condition part: else {
                    "match": "\\s*(else)\\s*(?=\\{)",
                    "captures": {
                        "1": { "name": "keyword.control.conditional.xjs" }
                    }
                }, {
                    "name": "string.regexp.ts",
                    "begin": "(?<=\\))\\s*\\/(?![\\/*])(?=(?:[^\\/\\\\\\[]|\\\\.|\\[([^\\]\\\\]|\\\\.)+\\])+\\/([gimsuy]+|(?![\\/\\*])|(?=\\/\\*))(?!\\s*[a-zA-Z0-9_$]))",
                    "beginCaptures": {
                        "0": { "name": "punctuation.definition.string.begin.ts" }
                    },
                    "end": "(/)([gimsuy]*)",
                    "endCaptures": {
                        "1": { "name": "punctuation.definition.string.end.ts" },
                        "2": { "name": "keyword.other.ts" }
                    },
                    "patterns": [
                        { "include": "#regexp" }
                    ]
                },
                { "include": "#" + prefix + "-decl-block" } // block part
            ]
        }]
    });

    if (prefix === "xjs") {
        // $for statement
        addStatement(g, prefix, prefix + "-for-statement", {
            "name": "for.statement.xjs",
            //"begin": "(?<![_$[:alnum:]])(?:(?<=\\.\\.\\.)|(?<!\\.))for(?=((\\s+|(\\s*\\/\\*([^\\*]|(\\*[^\\/]))*\\*\\/\\s*))await)?\\s*(\\/\\*([^\\*]|(\\*[^\\/]))*\\*\\/\\s*)?(\\())",
            "begin": "(\\$for)\\s+",
            "beginCaptures": {
                "1": { "name": "keyword.control.loop.xjs" }
            },
            "end": "(?<=\\})",
            "patterns": [
                { "include": "#comment" },
                {
                    // control declaration - e.g. (let i=0;1->i;i++)
                    "begin": "\\(",
                    "beginCaptures": {
                        "0": { "name": "meta.brace.round.ts" }
                    },
                    //"end": "\\)(?=\\s*\\{)",
                    "end": "\\)",
                    "endCaptures": {
                        "0": { "name": "meta.brace.round.ts" }
                    },
                    "patterns": [
                        { "include": "#var-expr" },
                        { "include": "#expression" },
                        { "include": "#punctuation-semicolon" }
                    ]
                },
                { "include": "#" + prefix + "-decl-block" } // block part
            ]
        });

        // $exec statement
        addStatement(g, prefix, prefix + "-exec-statement", {
            "name": "exec.statement.xjs",
            "begin": "(\\$exec)\\s+",
            "beginCaptures": {
                "1": { "name": "keyword.control.exec.xjs" }
            },
            "end": "(;)",
            "endCaptures": {
                "1": { "name": "punctuation.terminator.statement.ts" }
            },
            "patterns": [
                { "include": "#comment" },
                { "include": "#expression" },
                { "include": "#punctuation-semicolon" }
            ]
        });

        // $let statement
        addStatement(g, prefix, prefix + "-var-expr", {
            "name": "let.statement.xjs",
            "patterns": [
                {
                    "name": "meta.var.expr.ts",
                    "begin": "(\\$let)\\s+",
                    "beginCaptures": {
                        "1": { "name": "keyword.control.let.xjs" }
                    },
                    "end": "(;)",
                    "endCaptures": {
                        "1": { "name": "punctuation.terminator.statement.ts" }
                    },
                    "patterns": [
                        { "include": "#destructuring-variable" },
                        { "include": "#var-single-variable" },
                        { "include": "#variable-initializer" },
                        { "include": "#comment" },
                        {
                            "begin": "(,)\\s*((?!\\S)|(?=\\/\\/))",
                            "beginCaptures": {
                                "1": {
                                    "name": "punctuation.separator.comma.ts"
                                }
                            },
                            "end": "(?<!,)(((?==|;|}|((?<![_$[:alnum:]])(?:(?<=\\.\\.\\.)|(?<!\\.))(of|in)\\s+)|^\\s*$))|((?<=\\S)(?=\\s*$)))",
                            "patterns": [
                                { "include": "#single-line-comment-consuming-line-ending" },
                                { "include": "#comment" },
                                { "include": "#destructuring-variable" },
                                { "include": "#var-single-variable" },
                                { "include": "#punctuation-comma" }
                            ]
                        },
                        { "include": "#punctuation-comma" }
                    ]
                }
            ]
        });
    }

    // $each statement
    addStatement(g, prefix, prefix + "-each-statement", {
        "name": "each.statement.xjs",
        "begin": "(\\$each)\\s*(\\()",
        "beginCaptures": {
            "1": { "name": "keyword.control.each.xjs" },
            "2": { "name": "meta.brace.round.ts" }
        },
        "end": "(\\))(\\s*;)",
        "endCaptures": {
            "1": { "name": "meta.brace.round.ts" },
            "2": { "name": "punctuation.terminator.statement.ts" }
        },
        "patterns": [
            { "include": "#comment" },
            { "include": "#" + prefix + "-template-function" },
            { "include": expression },
            { "include": "#punctuation-comma" }
        ]
    });

    // $log statement
    addStatement(g, prefix, prefix + "-log-statement", {
        "name": "log.statement.xjs",
        "begin": "(\\$log)\\s*(\\()",
        "beginCaptures": {
            "1": { "name": "keyword.control.log.xjs" },
            "2": { "name": "meta.brace.round.ts" }
        },
        "end": "(\\))(\\s*;)",
        "endCaptures": {
            "1": { "name": "meta.brace.round.ts" },
            "2": { "name": "punctuation.terminator.statement.ts" }
        },
        "patterns": [
            { "include": "#comment" },
            { "include": expression },
            { "include": "#punctuation-comma" }
        ]
    });

    // TODO: $trackBy ?

    if (prefix === "xjs") {
        // $template statement
        addStatement(g, prefix, prefix + "-template-statement", {
            "name": "template.statement.xjs",
            "begin": "(\\$template)\\s+",
            "beginCaptures": {
                "1": { "name": "keyword.control.template.xjs" }
            },
            "end": "(?<=\\})", // after the block ending bracket
            "patterns": [
                { "include": "#function-name" },
                { "include": "#comment" },
                { "include": "#function-parameters" }, // e.g. (a:string, b:Foo)
                { "include": "#return-type" }, // e.g. : void
                { "include": "#" + prefix + "-decl-block" } // block part - e.g. { <div/> }
            ]
        });
    }
}

// function includeSpreadOperators(g: any, prefix: "xjs" | "xtc") {
//     // e.g. {...[expr()]}
//     addToRepository(g, prefix + "-tag-attribute-spread-property", {
//         "name": "entity.other.attribute.property.spread.js.xjs",
//         "begin": "\\s*" + attributeSeparator() + "(\\{)(\\.\\.\\.)(\\[)\\s*",
//         "beginCaptures": {
//             "1": { "name": "punctuation.section.embedded.begin.js.xjs" },
//             "2": { "name": "punctuation.section.embedded.modifier.js.xjs" },
//             "3": { "name": "punctuation.section.embedded.property.begin.js.xjs" }
//         },
//         "end": "\\s*(\\]\\})",
//         "endCaptures": {
//             "1": { "name": "punctuation.section.embedded.end.js.xjs" }
//         },
//         "patterns": [
//             { "include": "#expression" }
//         ]
//     });

//     // e.g. {...expr()}
//     addToRepository(g, prefix + "-tag-attribute-spread-param", {
//         "name": "entity.other.attribute.param.spread.js.xjs",
//         "begin": "\\s*" + attributeSeparator() + "(\\{)(\\.\\.\\.)\\s*",
//         "beginCaptures": {
//             "1": { "name": "punctuation.section.embedded.begin.js.xjs" },
//             "2": { "name": "punctuation.section.embedded.modifier.js.xjs" }
//         },
//         "end": "\\s*(\\})",
//         "endCaptures": {
//             "1": { "name": "punctuation.section.embedded.end.js.xjs" }
//         },
//         "patterns": [
//             { "include": "#expression" }
//         ]
//     });
// }
