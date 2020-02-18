
/**
 * This node script generates the xjs.tmLanguage.json file from the TypeScript.tmLanguage.json in the syntaxes folder
 * 
 * To generate a new grammar version:
 * - update the syntaxes/TypeScript.tmLanguage.json file from
 *   https://github.com/Microsoft/vscode/blob/master/extensions/typescript-basics/syntaxes/TypeScript.tmLanguage.json
 * - and run this script: yarn run generate
 */

import * as path from 'path';
import * as fs from 'fs';
import { includeXtrDef } from './xtr-grammar';
import common from './common';

// warning: __dirname is in the dist folder!
const TS_GRAMMAR_PATH = "../../syntaxes/TypeScript.tmLanguage.json",
    XJS_GRAMMAR_PATH = "../../syntaxes/xjs.tmLanguage.json",
    XJS_GRAMMAR_TS_PATH = "../../src/xjs/tm-grammar.ts",
    fsp = fs.promises;

main();

async function main() {
    let content = await fsp.readFile(path.join(__dirname, TS_GRAMMAR_PATH));

    let g = JSON.parse(content.toString());

    // update file
    g["information_for_contributors"] = "File generated by xjs/xjs-grammar";

    includeTemplateDef(g);
    includeExpressionBlock(g);
    includeXjsTag(g);
    includeTextNode(g);

    includeXtrDef(g);

    // copy node attributes patterns to decorator attributes patterns
    let xjsAttributePatterns = g.repository["xjs-tag-open"].patterns;
    g.repository["xjs-tag-attribute-decorator-with-attributes"].patterns = xjsAttributePatterns.slice(0);
    g.repository["xjs-text-node-attributes"].patterns = xjsAttributePatterns.slice(0);

    let xtrAttributePatterns = g.repository["xtr-tag-open"].patterns;
    g.repository["xtr-tag-attribute-decorator-with-attributes"].patterns = xtrAttributePatterns.slice(0);

    // save the new grammar
    const xjsFile = await fsp.open(path.join(__dirname, XJS_GRAMMAR_PATH), "w");
    const newContent = JSON.stringify(g, undefined, "\t");
    await fsp.writeFile(xjsFile, newContent);

    const xjsFile2 = await fsp.open(path.join(__dirname, XJS_GRAMMAR_TS_PATH), "w");
    const newContent2 = JSON.stringify(g);
    await fsp.writeFile(xjsFile2, "export default `" + newContent2.replace(/\\/g,"\\\\").replace(/\`/g,"\\`") + "`;", 'utf8');
}

/**
 * Include the support of xxx.template(` ...  `) in the ts files
 */
function includeTemplateDef(g: any) {
    // (?<=x) = positive lookbehind - cf. https://www.regular-expressions.info/lookaround.html
    g.repository.template.patterns.splice(0, 0, {
        "name": "xjs.template.ts",
        "begin": "((?<=(template\\())\\s*`)", // grammar doesn't accept \\s* after template (i.e. template\\s*\\( ) --> ??
        "beginCaptures": {
            "1": { "name": "punctuation.definition.xjs.template.begin.ts" }
        },
        "end": "`",
        "endCaptures": {
            "0": { "name": "punctuation.definition.xjs.template.end.ts" }
        },
        "patterns": [
            { "include": "#arrow-function" }
        ]
    });
}

function addStatement(g: any, name: string, json: any) {
    g.repository[name] = json;
    g.repository.statements.patterns.splice(0, 0, {
        "include": "#" + name
    });
}

function includeXjsTag(g: any) {
    let tagName = "(\\!|((\\@|\\.|\\*)?[a-zA-Z][\\w\\-\\.]*))";

    addStatement(g, "xjs-tag-open", {
        "name": "meta.tag.js.xjs",
        "begin": "\\s*(<(?![/\\s\\d]))" + tagName,
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
            { "include": "#comment" } // other patterns are included by the attribute definitions (cf. below)
        ]
    });

    addStatement(g, "xjs-tag-open-expression", {
        "name": "meta.tag.js.xjs",
        "begin": "\\s*(<)(\\.|\\*)?((?=\\{))",
        "beginCaptures": {
            "1": { "name": "punctuation.definition.tag.begin.js.xjs" },
            "2": { "name": "entity.name.tag.prefix.js.xjs" }
        },
        "end": "(\\/?)(\\>)",
        "endCaptures": {
            "1": { "name": "punctuation.definition.tag.close.js.xjs" },
            "2": { "name": "punctuation.definition.tag.end.js.xjs" }
        },
        "patterns": [
            { "include": "#xjs-expression-block" },
            { "include": "#comment" } // other patterns are included by the attribute definitions (cf. below)
        ]
    });

    //includeNameExpressionBlock(g);

    // attributes: order matters -> most selective first:
    common.includeLabelAttributes(g, addXjsTagAttributeType, "xjs", attributeValues);
    common.includeDecoratorAttributes(g, addXjsTagAttributeType, "xjs", attributeValues);
    includeBindingShortcuts(g);
    includeSpreadOperators(g);
    common.includeStandardAttributes(g, addXjsTagAttributeType, "xjs", attributeValues);

    addStatement(g, "xjs-tag-close", {
        "name": "meta.tag.js.xjs",
        "begin": "\\s*(<)(/)" + tagName + "?",
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

function includeTextNode(g: any) {
    // text node declaration - e.g. * Hello World *
    addStatement(g, "xjs-text-node", {
        "name": "string.xjs.text.node.ts",
        "begin": "\\s*(\\#)",
        "beginCaptures": {
            "1": { "name": "punctuation.definition.string.begin.js.xjs" }
        },
        "end": "((?<!&)\\#)", // negative look behind to ignore html entities - e.g. &#160;
        "endCaptures": {
            "1": { "name": "punctuation.definition.string.end.js.xjs" }
        },
        "patterns": [
            { "include": "#xjs-text-node-attributes" },
            { "include": "#string-character-escape" },
            //{ "include": "#xjs-text-html-entity" }, // will not be supported - UTF8 should be use instead
            { "include": "#xjs-expression-block" }
        ]
    });

    // text nodes with attributes - e.g. # (#myNode @i18n(ref=123 gender={getGender()})) Blah blah #
    g.repository["xjs-text-node-attributes"] = {
        "name": "meta.block.attributes.ts",
        "begin": "(?<=\\#)\\s*(\\()",
        "beginCaptures": {
            "0": { "name": "punctuation.section.embedded.begin.js.xjs" }
        },
        "end": "\\)",
        "endCaptures": {
            "0": { "name": "punctuation.section.embedded.end.js.xjs" }
        },
        "patterns": []
    }

    // html entities - e.g. &lt; &nbsp; &#160;
    g.repository["xjs-text-html-entity"] = {
        "name": "constant.character.entity.js.xjs",
        "match": "(\\&[a-z]+\\;)|(\\&\\#[0-9]+\\;)"
    }
}

function includeExpressionBlock(g: any) {
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

function addXjsTagAttributeType(g: any, name: string, json: any) {
    g.repository[name] = json;
    g.repository["xjs-tag-open"].patterns.push(
        { "include": "#" + name }
    );
    g.repository["xjs-tag-open-expression"].patterns.push(
        { "include": "#" + name }
    );
}

function attributeSeparator() {
    return "(?<= |\\(|^)";
}

function attributeName(withDots = false, withDashes = false) {
    if (withDashes) {
        return withDots ? "[\\$\\w][\\w\\-\\.]*" : "[\\$\\w][\\w\\-]*"
    }
    return withDots ? "[\\$\\w][\\w\\.]*" : "[\\$\\w]\\w*"
}

function attributeValues() {
    return [
        { "include": "#numeric-literal" },
        { "include": "#boolean-literal" },
        { "include": "#string" },
        { "include": "#xjs-expression-function-block" },
        { "include": "#xjs-expression-block" }
    ]
}

function includeBindingShortcuts(g: any) {
    // e.g. {[name]} or {::[name]}
    addXjsTagAttributeType(g, "xjs-tag-attribute-binding-property", {
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
    addXjsTagAttributeType(g, "xjs-tag-attribute-binding-param", {
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

function includeSpreadOperators(g: any) {
    // e.g. {...[expr()]}
    addXjsTagAttributeType(g, "xjs-tag-attribute-spread-property", {
        "name": "entity.other.attribute.property.spread.js.xjs",
        "begin": "\\s*" + attributeSeparator() + "(\\{)(\\.\\.\\.)(\\[)\\s*",
        "beginCaptures": {
            "1": { "name": "punctuation.section.embedded.begin.js.xjs" },
            "2": { "name": "punctuation.section.embedded.modifier.js.xjs" },
            "3": { "name": "punctuation.section.embedded.property.begin.js.xjs" }
        },
        "end": "\\s*(\\]\\})",
        "endCaptures": {
            "1": { "name": "punctuation.section.embedded.end.js.xjs" }
        },
        "patterns": [
            { "include": "#expression" }
        ]
    });

    // e.g. {...expr()}
    addXjsTagAttributeType(g, "xjs-tag-attribute-spread-param", {
        "name": "entity.other.attribute.param.spread.js.xjs",
        "begin": "\\s*" + attributeSeparator() + "(\\{)(\\.\\.\\.)\\s*",
        "beginCaptures": {
            "1": { "name": "punctuation.section.embedded.begin.js.xjs" },
            "2": { "name": "punctuation.section.embedded.modifier.js.xjs" }
        },
        "end": "\\s*(\\})",
        "endCaptures": {
            "1": { "name": "punctuation.section.embedded.end.js.xjs" }
        },
        "patterns": [
            { "include": "#expression" }
        ]
    });
}
