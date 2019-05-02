
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

const TS_GRAMMAR_PATH = "../../syntaxes/TypeScript.tmLanguage.json",
    XJS_GRAMMAR_PATH = "../../syntaxes/xjs.tmLanguage.json",
    fsp = fs.promises;

main();

async function main() {
    let content = await fsp.readFile(path.join(__dirname, TS_GRAMMAR_PATH));

    let g = JSON.parse(content.toString());

    // update file
    g["information_for_contributors"] = "File generated by vscode-xjs/grammar on " + (new Date()).toUTCString();

    includeTemplateDef(g);
    includeExpressionBlock(g);
    includeXjsTag(g);
    includeTextNode(g);

    // copy node attributes patterns to decorator attributes patterns
    let attributePatterns = g.repository["xjs-tag-open"].patterns;
    g.repository["xjs-tag-attribute-decorator-with-attributes"].patterns = attributePatterns.slice(0);
    g.repository["xjs-text-node-attributes"].patterns = attributePatterns.slice(0);

    // save the new grammar
    let xjsFile = await fsp.open(path.join(__dirname, XJS_GRAMMAR_PATH), "w")
    await fsp.writeFile(xjsFile, JSON.stringify(g, undefined, "\t"));

    // console.log("Generation complete")
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
    includeRefAttributes(g);
    includeDecoratorAttributes(g);
    includePropertyAttributes(g);
    includeEvtListenerAttributes(g);
    includeNormalAttributes(g);

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
        "end": "((?<!&)\\#)", // negative look behind to support html entities - e.g. &#160;
        "endCaptures": {
            "1": { "name": "punctuation.definition.string.end.js.xjs" }
        },
        "patterns": [
            { "include": "#xjs-text-node-attributes" },
            { "include": "#string-character-escape" },
            { "include": "#xjs-text-html-entity" },
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
    return "(?<= |\\()";
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
        { "include": "#xjs-expression-block" }
    ]
}

function includeNormalAttributes(g: any) {
    // attribute with value - e.g. <span foo={a*2+123} aria-label="abc" />
    addXjsTagAttributeType(g, "xjs-tag-attribute", {
        "name": "tag.attribute.assignment",
        "begin": "\\s*(" + attributeSeparator() + attributeName(false, true) + ")\\s*(=)\\s*",
        "beginCaptures": {
            "1": { "name": "entity.other.attribute-name.js.xjs" },
            "2": { "name": "keyword.operator.assignment.js.xjs" }
        },
        "end": " |(?=>)|(?=/)|(?=\\))",
        "patterns": attributeValues()
    });

    // no values attribute - e.g. <div disabled/>
    addXjsTagAttributeType(g, "xjs-tag-attribute-no-values", {
        "name": "tag.attribute",
        "match": "\\s*(" + attributeSeparator() + attributeName(false, true) + ")(?=(\\s|/|>|\\)))", // no need to support . notation
        "captures": {
            "1": { "name": "entity.other.attribute-name.js.xjs" }
        }
    });
}

function includePropertyAttributes(g: any) {
    // property attribute - e.g. <div [foo]=123 [baz]={expr()} />
    addXjsTagAttributeType(g, "xjs-tag-property", {
        "name": "tag.attribute.property.assignment",
        "begin": "(" + attributeSeparator() + "\\[)(" + attributeName() + ")(\\])\\s*(=)\\s*",
        "beginCaptures": {
            "1": { "name": "punctuation.section.embedded.property.begin.js.xjs" },
            "2": { "name": "entity.other.attribute-name.js.xjs" },
            "3": { "name": "punctuation.section.embedded.property.end.js.xjs" },
            "4": { "name": "keyword.operator.assignment.js.xjs" }
        },
        "end": " |(?=>)|(?=/)|(?=\\))",
        "patterns": attributeValues()
    });
}

function includeDecoratorAttributes(g: any) {
    // decorator with value - e.g. @class="foo"
    addXjsTagAttributeType(g, "xjs-tag-attribute-decorator", {
        "name": "tag.attribute.decorator.assignment",
        "begin": "\\s*(" + attributeSeparator() + "\\@)(" + attributeName(true) + ")\\s*(\\=)\\s*",
        "beginCaptures": {
            "1": { "name": "punctuation.section.embedded.decorator.js.xjs" },
            "2": { "name": "entity.other.attribute-name.js.xjs" },
            "3": { "name": "keyword.operator.assignment.js.xjs" }
        },
        "end": " |(?=>)|(?=/)|(?=\\))",
        "patterns": attributeValues()
    });

    // decorator with its own attributes
    addXjsTagAttributeType(g, "xjs-tag-attribute-decorator-with-attributes", {
        "name": "tag.attribute.decorator.assignment",
        "begin": "\\s*(" + attributeSeparator() + "\\@)(" + attributeName(true) + ")\\s*(\\()\\s*",
        "beginCaptures": {
            "1": { "name": "punctuation.section.embedded.decorator.js.xjs" },
            "2": { "name": "entity.other.attribute-name.js.xjs" },
            "3": { "name": "punctuation.section.embedded.decorator.begin.js.xjs" }
        },
        "end": "(\\))",
        "endCaptures": {
            "0": { "name": "punctuation.section.embedded.decorator.end.js.xjs" }
        },
        "patterns": [] // will be copied from "xjs-tag-open" (cf. above)
    });

    // decorator with no values - e.g. @host
    addXjsTagAttributeType(g, "xjs-tag-attribute-decorator-no-values", {
        "name": "entity.other.attribute.decorator.js.xjs",
        "match": "\\s*" + attributeSeparator() + "(\\@)(" + attributeName(true) + ")(?=(\\s|/|>|\\)))",
        "captures": {
            "1": { "name": "punctuation.section.embedded.decorator.js.xjs" },
            "2": { "name": "entity.other.attribute-name.js.xjs" }
        }
    });
}

function includeRefAttributes(g: any) {
    // ref attribute with expression - e.g. <div #foo[{expr()}]/>
    addXjsTagAttributeType(g, "xjs-tag-attribute-ref", {
        "name": "entity.other.attribute.ref.js.xjs",
        "begin": "\\s*" + attributeSeparator() + "(\\#)(" + attributeName() + ")(\\[\\{)",
        "beginCaptures": {
            "1": { "name": "punctuation.section.embedded.ref.js.xjs" },
            "2": { "name": "entity.other.attribute-name.js.xjs" },
            "3": { "name": "punctuation.section.embedded.ref.collection.start.js.xjs" }
        },
        "end": "\\s*\\}\\]",
        "endCaptures": {
            "0": { "name": "punctuation.section.embedded.ref.collection.end.js.xjs" }
        },
        "patterns": [
            { "include": "#expression" }
        ]
    });

    // ref attribute w/o expressions - e.g. <div #foo #bar[]/>
    addXjsTagAttributeType(g, "xjs-tag-attribute-ref-no-expr", {
        "name": "entity.other.attribute.ref.js.xjs",
        "match": "\\s*" + attributeSeparator() + "(\\#)(" + attributeName() + ")(\\[\\s*\\])?",
        "captures": {
            "1": { "name": "punctuation.section.embedded.ref.js.xjs" },
            "2": { "name": "entity.other.attribute-name.js.xjs" },
            "3": { "name": "punctuation.section.embedded.ref.collection.js.xjs" }
        }
    });
}

function includeEvtListenerAttributes(g: any) {
    // function attributes - e.g. click(e)={doSomething(e);doSomethingElse();return false}

    addXjsTagAttributeType(g, "xjs-tag-attribute-function", {
        "name": "tag.attribute.assignment",
        "begin": "\\s*(" + attributeName(true) + ")(?=(\\())",
        "beginCaptures": {
            "1": { "name": "entity.other.attribute-name.js.xjs" }
        },
        "end": " (?!(\\s*\\=))|(?=>)|(?=/)|(?=\\))",
        "patterns": [
            { "include": "#function-parameters" },
            { "name": "keyword.operator.assignment.js.xjs", "match": "\\s*(\\=)\\s*" },
            {
                "name": "meta.block.ts",
                "begin": "\\s*(\\{)",
                "beginCaptures": {
                    "1": { "name": "punctuation.section.embedded.begin.js.xjs" } // change default name to get same highlighting as other expression blocks
                },
                "end": "\\s*(\\})",
                "endCaptures": {
                    "1": { "name": "punctuation.section.embedded.end.js.xjs" }
                },
                "patterns": [
                    { "include": "#statements" }
                ]
            }
        ]
    });

}