import common from './common';

/**
 * Include the support of xtr` ...  ` in the ts files
 */
export function includeXtrDef(g: any) {
    // (?<=x) = positive lookbehind - cf. https://www.regular-expressions.info/lookaround.html
    g.repository.template.patterns.splice(0, 0, {
        "name": "xtr.template.ts",
        "begin": "(xtr)\\s*(`)",
        "beginCaptures": {
            "1": { "name": "entity.name.function.ts" },
            "2": { "name": "punctuation.definition.xtr.template.begin.ts" }
        },
        "end": "`",
        "endCaptures": {
            "0": { "name": "punctuation.definition.xtr.template.end.ts" }
        },
        "patterns": [
            { "include": "#xtr-cdata" },
            { "include": "#xtr-tag-open-tpl-substitution" },
            { "include": "#xtr-tag-open" },
            { "include": "#xtr-tag-close" },
            { "include": "#template-substitution-element" },
            { "include": "#comment" },
            { "include": "#string-character-escape" }
        ]
    });

    includeXtrCData(g);
    includeXtrTags(g);
    includeXtrAttributes(g);
}

function includeXtrCData(g: any) {
    g.repository["xtr-cdata"] = {
        "name": "meta.tag.js.xjs",
        "begin": "(<)(\\!cdata)",
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
                "include": "#xtr-attributes"
            },
            {
                "include": "#xtr-cdata-content"
            }
        ]
    };

    g.repository["xtr-cdata-content"] = {
        "name": "cdata.content.xtr",
        "begin": "\\s*(>)",
        "beginCaptures": {
            "1": {
                "name": "punctuation.definition.tag.end.js.xjs"
            }
        },
        "end": "(?=</\\!cdata>)",
        "patterns": [
            {
                "include": "#xtr-cdata-string"
            },
            {
                "include": "#xtr-cdata-string-end"
            }
        ]
    };

    g.repository["xtr-cdata-string"] = {
        "name": "cdata.content.xtr", // can also use string.cdata.content.xtr to get 'string' highlighting
        "match": "((\\\\</\\!cdata>)|(.(?!</\\!cdata>)))+"
    };

    g.repository["xtr-cdata-string-end"] = {
        "name": "cdata.content.xtr",
        "match": ".(?=</\\!cdata>)"
    };
}

function includeXtrTags(g: any) {
    g.repository["xtr-tag-open"] = {
        "name": "meta.tag.js.xjs",
        "begin": "(<(?![/\\s\\d]))(\\!|((\\@|\\.|\\*)?[a-zA-Z][\\w\\-\\.]*))",
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
            { "include": "#xtr-attributes" }
        ]
    };

    g.repository["xtr-tag-close"] = {
        "name": "meta.tag.js.xjs",
        "begin": "(<)(/)(\\!|((\\@|\\.|\\*)?[a-zA-Z][\\w\\-\\.]*))?",
        "beginCaptures": {
            "1": { "name": "punctuation.definition.tag.begin.js.xjs" },
            "2": { "name": "punctuation.definition.tag.close.js.xjs" },
            "3": { "name": "entity.name.tag.js.xjs" }
        },
        "end": ">",
        "endCaptures": {
            "0": { "name": "punctuation.definition.tag.end.js.xjs" }
        }
    };

    g.repository["xtr-tag-open-tpl-substitution"] = {
        "name": "meta.tag.js.xjs",
        "begin": "(<(?=\\$\\{))",
        "beginCaptures": {
            "1": { "name": "punctuation.definition.tag.begin.js.xjs" }
        },
        "end": "(\\/?)(\\>)",
        "endCaptures": {
            "1": { "name": "punctuation.definition.tag.close.js.xjs" },
            "2": { "name": "punctuation.definition.tag.end.js.xjs" }
        },
        "patterns": [
            { "include": "#xtr-attributes" }
        ]
    };
}

function addToRepo(g: any, name: string, json: any) {
    g.repository[name] = json;
}

function attributeValues() {
    return [
        { "include": "#xtr-attributes-values" }
    ]
}

function includeXtrAttributes(g: any) {

    g.repository["xtr-ref"] = {
        "name": "punctuation.accessor.ts",
        "match": "a-z[a-zA-Z0-9_]*"
    };

    g.repository["xtr-expression-ref"] = {
        "name": "entity.other.attribute.reference.js.xtr",
        "begin": "(?!\\\\)(\\{)((\\:\\:)|(\\=))?",
        "beginCaptures": {
            "1": {
                "name": "punctuation.section.embedded.begin.js.xtr"
            },
            "2": {
                "name": "punctuation.section.embedded.modifier.js.xtr"
            }
        },
        "end": "\\}",
        "endCaptures": {
            "0": {
                "name": "punctuation.section.embedded.end.js.xtr"
            }
        },
        "patterns": [
            { "include": "#xtr-ref" }
        ]
    };

    g.repository["xtr-attributes"] = {
        "patterns": [
            { "include": "#template-substitution-element" },
            { "include": "#comment" },
            { "include": "#xtr-tag-attribute-label" },
            { "include": "#xtr-tag-attribute-label-no-expr" },
            { "include": "#xtr-tag-attribute-decorator" },
            { "include": "#xtr-tag-attribute-decorator-with-attributes" },
            { "include": "#xtr-tag-attribute-decorator-no-values" },
            { "include": "#xtr-tag-property" },
            { "include": "#xtr-tag-attribute" },
            { "include": "#xtr-tag-attribute-no-values" }
        ]
    };

    g.repository["xtr-attributes-values"] = {
        "name": "entity.other.attribute.value",
        "patterns": [
            { "include": "#template-substitution-element" },
            { "include": "#numeric-literal" },
            { "include": "#boolean-literal" },
            { "include": "#string" },
            { "include": "#xtr-expression-ref" }
        ]
    };

    common.includeLabelAttributes(g, addToRepo, "xtr", attributeValues);
    common.includeDecoratorAttributes(g, addToRepo, "xtr", attributeValues);
    common.includeStandardAttributes(g, addToRepo, "xtr", attributeValues);
}