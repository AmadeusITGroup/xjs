
function attributeSeparator() {
    return "(?<= |\\(|^|\<)";
}

function attributeName(withDots = false, withDashes = false) {
    if (withDashes) {
        return withDots ? "[\\$\\w][\\w\\-\\.]*" : "[\\$\\w][\\w\\-]*"
    }
    return withDots ? "[\\$\\w][\\w\\.]*" : "[\\$\\w]\\w*"
}

interface AddToRepoFunction {
    (g: any, name: string, json: any): void;
}

export default {
    includeLabelAttributes(g: any, addToRepo: AddToRepoFunction, prefix: string /* e.g. "xjs" */, attributeValues: () => any) {
        // label attributes w/ expression - e.g. #foo={bar()}
        addToRepo(g, prefix + "-tag-attribute-label", {
            "name": "entity.other.attribute.label.js.xjs",
            "begin": "\\s*(" + attributeSeparator() + "\\#\\#?)(" + attributeName(true) + ")\\s*(\\=)\\s*",
            "beginCaptures": {
                "1": { "name": "punctuation.section.embedded.label.js.xjs" },
                "2": { "name": "entity.other.attribute-name.js.xjs" },
                "3": { "name": "keyword.operator.assignment.js.xjs" }
            },
            "end": " |(?=>)|(?=/)|(?=\\))",
            "patterns": attributeValues()
        });

        // label attribute w/o expressions - e.g. <div #foo #bar/>
        addToRepo(g, prefix + "-tag-attribute-label-no-expr", {
            "name": "entity.other.attribute.label.js.xjs",
            "match": "\\s*" + attributeSeparator() + "(\\#\\#?)(" + attributeName() + ")",
            "captures": {
                "1": { "name": "punctuation.section.embedded.label.js.xjs" },
                "2": { "name": "entity.other.attribute-name.js.xjs" }
            }
        });
    },
    includeStandardAttributes(g: any, addToRepo: AddToRepoFunction, prefix: string, attributeValues: () => any, includeProperties = true) {
        // attribute with value - e.g. <span foo={a*2+123} aria-label="abc" />
        if (includeProperties) {
            // property attribute - e.g. <div [foo]=123 [baz]={expr()} />
            addToRepo(g, prefix + "-tag-property", {
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

        addToRepo(g, prefix + "-tag-attribute", {
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
        addToRepo(g, prefix + "-tag-attribute-no-values", {
            "name": "tag.attribute",
            "match": "\\s*(" + attributeSeparator() + attributeName(false, true) + ")(?=(\\s|/|>|\\)))", // no need to support . notation
            "captures": {
                "1": { "name": "entity.other.attribute-name.js.xjs" }
            }
        });
    },
    includeDecoratorAttributes(g: any, addToRepo: AddToRepoFunction, prefix: string, attributeValues: () => any) {
        const pp = prefix === "xtr" ? "{1,2}" : ""; // pre-processor support

        // decorator with value - e.g. @class="foo"
        addToRepo(g, prefix + "-tag-attribute-decorator", {
            "name": "tag.attribute.decorator.assignment",
            "begin": "\\s*(" + attributeSeparator() + "\\@" + pp + ")(" + attributeName(true) + ")\\s*(\\=)\\s*",
            "beginCaptures": {
                "1": { "name": "punctuation.section.embedded.decorator.js.xjs" },
                "2": { "name": "entity.other.attribute-name.js.xjs" },
                "3": { "name": "keyword.operator.assignment.js.xjs" }
            },
            "end": " |(?=>)|(?=/)|(?=\\))",
            "patterns": attributeValues()
        });

        // decorator with its own attributes
        addToRepo(g, prefix + "-tag-attribute-decorator-with-attributes", {
            "name": "tag.attribute.decorator.assignment",
            "begin": "\\s*(" + attributeSeparator() + "\\@" + pp + ")(" + attributeName(true) + ")\\s*(\\()\\s*",
            "beginCaptures": {
                "1": { "name": "punctuation.section.embedded.decorator.js.xjs" },
                "2": { "name": "entity.other.attribute-name.js.xjs" },
                "3": { "name": "punctuation.section.embedded.decorator.begin.js.xjs" }
            },
            "end": "(\\))",
            "endCaptures": {
                "0": { "name": "punctuation.section.embedded.decorator.end.js.xjs" }
            },
            "patterns": [] // will be copied from "xjs-tag-open" or "xtr-tag-open"
        });

        // decorator with no values - e.g. @host
        addToRepo(g, prefix + "-tag-attribute-decorator-no-values", {
            "name": "entity.other.attribute.decorator.js.xjs",
            "match": "\\s*" + attributeSeparator() + "(\\@" + pp + ")(" + attributeName(true) + ")(?=(\\s|/|>|\\)))",
            "captures": {
                "1": { "name": "punctuation.section.embedded.decorator.js.xjs" },
                "2": { "name": "entity.other.attribute-name.js.xjs" }
            }
        });
    }
}
