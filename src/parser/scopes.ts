
export const
    ATT = "tag.attribute.assignment",
    ATT1 = "tag.attribute",
    A_NAME = "entity.other.attribute-name.js.xjs",
    BLOCK = "meta.block.ts",
    B_DEF = "punctuation.definition.block.ts",
    COMMENT = "comment.block.ts",
    C_DEF = "punctuation.definition.comment.ts",
    DECO = "tag.attribute.decorator.assignment",
    DECO1 = "entity.other.attribute.decorator.js.xjs",
    D_DEF = "punctuation.section.embedded.decorator.js.xjs",
    PR = "tag.attribute.property.assignment",
    PR_START = "punctuation.section.embedded.property.begin.js.xjs",
    REF = "entity.other.attribute.ref.js.xjs",
    R_DEF = "punctuation.section.embedded.ref.js.xjs";

export const SCOPES = {
    "tag.attribute": "ATT1",
    "tag.attribute.assignment": "ATT",
    "entity.other.attribute-name.js.xjs": "A_NAME",

    "meta.arrow.ts": "ARROW_FUNCTION",
    "storage.type.function.arrow.ts": "ARROW",

    "meta.block.ts": "BLOCK",
    "punctuation.definition.block.ts": "B_DEF",
    "punctuation.section.embedded.begin.js.xjs": "B_START",
    "punctuation.section.embedded.end.js.xjs": "B_END",
    "meta.brace.round.ts": "BRACE_R",

    "comment.block.ts": "COMMENT",
    "punctuation.definition.comment.ts": "C_DEF",
    "content": "CONTENT",

    "entity.other.attribute.decorator.js.xjs": "DECO1",
    "tag.attribute.decorator.assignment": "DECO",
    "punctuation.section.embedded.decorator.js.xjs": "D_DEF",
    "punctuation.section.embedded.decorator.begin.js.xjs": "D_START",
    "punctuation.section.embedded.decorator.end.js.xjs": "D_END",

    "constant.character.escape.ts": "ESC",
    "constant.character.entity.js.xjs": "ENTITY",
    "punctuation.section.embedded.modifier.js.xjs": "EXP_MOD",
    "keyword.operator.assignment.js.xjs": "EQ",
    "keyword.operator.assignment": "EQ",

    "meta.function-call.ts": "F_CALL",
    "entity.name.function.ts": "F_NAME",

    "constant.numeric.decimal.ts": "NUM",

    "keyword.operator.arithmetic.ts": "OP",

    "variable.other.property.ts": "PROP",
    "meta.parameters.ts": "PARAM",
    "punctuation.definition.parameters.begin.ts": "P_START",
    "punctuation.definition.parameters.end.ts": "P_END",
    "variable.parameter.ts": "P_VAR",
    "tag.attribute.property.assignment": "PR",
    "punctuation.section.embedded.property.begin.js.xjs": "PR_START",
    "punctuation.section.embedded.property.end.js.xjs": "PR_END",

    "entity.other.attribute.ref.js.xjs": "REF",
    "punctuation.section.embedded.ref.js.xjs": "R_DEF",
    "punctuation.section.embedded.ref.collection.js.xjs": "R_COL",
    "punctuation.section.embedded.ref.collection.start.js.xjs": "R_COL_START",
    "punctuation.section.embedded.ref.collection.end.js.xjs": "R_COL_END",

    "source.ts": "S",
    "string.quoted.double.ts": "STR_D",
    "punctuation.definition.string.begin.ts": "S_START",
    "punctuation.definition.string.end.ts": "S_END",
    "punctuation.separator.parameter.ts": "SEP",

    "meta.tag.js.xjs": "TAG",
    "entity.name.tag.js.xjs": "T_NAME",
    "entity.name.tag.prefix.js.xjs": "T_PREFIX",
    "punctuation.definition.tag.begin.js.xjs": "T_START",
    "punctuation.definition.tag.end.js.xjs": "T_END",
    "punctuation.definition.tag.close.js.xjs": "T_CLOSE",
    "string.xjs.text.node.ts": "TXT",
    "punctuation.definition.string.begin.js.xjs": "TXT_START",
    "punctuation.definition.string.end.js.xjs": "TXT_END",
    "constant.language.boolean.true.ts": "TRUE",

    "meta.type.annotation.ts": "TYPE_AN",
    "keyword.operator.type.annotation.ts": "TYPE_SEP",
    "support.type.primitive.ts": "TYPE_PRIMITIVE",

    "variable.other.object.ts": "VAR",
    "variable.other.readwrite.ts": "V_RW",
    "punctuation.accessor.ts": "V_ACC"
}