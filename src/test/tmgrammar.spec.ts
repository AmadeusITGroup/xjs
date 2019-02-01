import * as assert from 'assert';
import { parseContent } from './tmparser';
import { IToken } from 'vscode-textmate';


describe('TextMate grammar', () => {

    const SCOPES = {
        "tag.attribute": "ATT1",
        "tag.attribute.assignment": "ATT",
        "entity.other.attribute-name.js.xjs": "A_NAME",

        "meta.block.ts": "BLOCK",
        "punctuation.definition.block.ts": "B_DEF",
        "punctuation.section.embedded.begin.js.xjs": "B_DEF",
        "punctuation.section.embedded.end.js.xjs": "B_DEF",
        "meta.brace.round.ts": "BRACE.R",

        "comment.block.ts": "C",
        "punctuation.definition.comment.ts": "C_DEF",

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

        "variable.other.object.ts": "VAR",
        "variable.other.readwrite.ts": "V_RW",
        "punctuation.accessor.ts": "V_ACC"
    }

    function lineInfo(tokens: IToken[]) {
        let r: string[] = [], len = tokens.length, t: IToken, scope: string[], tmp: string;
        for (let i = 0; len > i; i++) {
            t = tokens[i];
            scope = [];
            for (let j = 0; t.scopes.length > j; j++) {
                scope.push(SCOPES[t.scopes[j]] || t.scopes[j]);
            }
            r.push(`${t.startIndex}:${t.endIndex}/${scope.join("/")}`);
        }
        return r.join("  ");
    }

    it("should support xml tag start", async function () {
        let r: IToken[][];
        r = await parseContent('<div>');
        assert.equal(lineInfo(r[0]), "0:1/S/TAG/T_START  1:4/S/TAG/T_NAME  4:5/S/TAG/T_END", "<div>");

        r = await parseContent('<span/>');
        assert.equal(lineInfo(r[0]), "0:1/S/TAG/T_START  1:5/S/TAG/T_NAME  5:6/S/TAG/T_CLOSE  6:7/S/TAG/T_END", "<span/>");

        r = await parseContent('<a-bcd /* comment */ />');
        assert.equal(lineInfo(r[0]), "0:1/S/TAG/T_START  1:6/S/TAG/T_NAME  6:7/S/TAG  7:9/S/TAG/C/C_DEF  9:18/S/TAG/C  18:20/S/TAG/C/C_DEF  20:21/S/TAG  21:22/S/TAG/T_CLOSE  22:23/S/TAG/T_END", "with comment");

        r = await parseContent('<$foo>');
        assert.equal(lineInfo(r[0]), "0:1/S/TAG/T_START  1:5/S/TAG/T_NAME  5:6/S/TAG/T_END", "<$foo>");

        r = await parseContent('<$foo.bar />');
        assert.equal(lineInfo(r[0]), "0:1/S/TAG/T_START  1:9/S/TAG/T_NAME  9:10/S/TAG  10:11/S/TAG/T_CLOSE  11:12/S/TAG/T_END", "<$foo.bar />");

        r = await parseContent('<.item/>');
        assert.equal(lineInfo(r[0]), "0:1/S/TAG/T_START  1:6/S/TAG/T_NAME  6:7/S/TAG/T_CLOSE  7:8/S/TAG/T_END", "<.item/>");

        r = await parseContent('<.@abc.def>');
        assert.equal(lineInfo(r[0]), "0:1/S/TAG/T_START  1:10/S/TAG/T_NAME  10:11/S/TAG/T_END", "<.@abc.def>");

        r = await parseContent('<!>');
        assert.equal(lineInfo(r[0]), "0:1/S/TAG/T_START  1:2/S/TAG/T_NAME  2:3/S/TAG/T_END", "<!>");

    });

    it("should support xml tag end", async function () {
        let r: IToken[][];
        r = await parseContent('</div>');
        assert.equal(lineInfo(r[0]), "0:1/S/TAG/T_START  1:2/S/TAG/T_CLOSE  2:5/S/TAG/T_NAME  5:6/S/TAG/T_END", "</div>");

        r = await parseContent('</! >');
        assert.equal(lineInfo(r[0]), "0:1/S/TAG/T_START  1:2/S/TAG/T_CLOSE  2:3/S/TAG/T_NAME  3:4/S/TAG  4:5/S/TAG/T_END", "</!>");

        r = await parseContent('</>');
        assert.equal(lineInfo(r[0]), "0:1/S/TAG/T_START  1:2/S/TAG/T_CLOSE  2:3/S/TAG/T_END", "</>");

        r = await parseContent('</$a.b.c> ');
        assert.equal(lineInfo(r[0]), "0:1/S/TAG/T_START  1:2/S/TAG/T_CLOSE  2:8/S/TAG/T_NAME  8:9/S/TAG/T_END  9:11/S", "</$a.b.c >"); // should be 9:10/S -> tm bug??
    });

    it("should support text nodes", async function () {
        let r: IToken[][];
        r = await parseContent('# Hello World #');
        assert.equal(lineInfo(r[0]), "0:1/S/TXT/TXT_START  1:14/S/TXT  14:15/S/TXT/TXT_END", "# Hello World #");

        r = await parseContent('# some text  \n on 2 lines with an escaped \\#! #');
        assert.equal(lineInfo(r[0]), "0:1/S/TXT/TXT_START  1:14/S/TXT", "multi line - line 0");
        assert.equal(lineInfo(r[1]), "0:28/S/TXT  28:30/S/TXT/ESC  30:32/S/TXT  32:33/S/TXT/TXT_END", "multi line - line 1");

        r = await parseContent('# &lt; &nbsp;&#160;#');
        assert.equal(lineInfo(r[0]), "0:1/S/TXT/TXT_START  1:2/S/TXT  2:6/S/TXT/ENTITY  6:7/S/TXT  7:13/S/TXT/ENTITY  13:19/S/TXT/ENTITY  19:20/S/TXT/TXT_END", "entities");

        r = await parseContent('# Hello {1+2} #');
        assert.equal(lineInfo(r[0]), "0:1/S/TXT/TXT_START  1:8/S/TXT  8:9/S/TXT/BLOCK/B_DEF  9:10/S/TXT/BLOCK/NUM  10:11/S/TXT/BLOCK/OP  11:12/S/TXT/BLOCK/NUM  12:13/S/TXT/BLOCK/B_DEF  13:14/S/TXT  14:15/S/TXT/TXT_END", "# Hello {1+2} #");
    });

    it("should support attributes", async function () {
        let r: IToken[][];
        r = await parseContent('<div foo=123>');
        assert.equal(lineInfo(r[0]), "0:1/S/TAG/T_START  1:4/S/TAG/T_NAME  4:5/S/TAG/ATT  5:8/S/TAG/ATT/A_NAME  8:9/S/TAG/ATT/EQ  9:12/S/TAG/ATT/NUM  12:13/S/TAG/T_END", "foo=123");

        r = await parseContent('<div bar = true>');
        assert.equal(lineInfo(r[0]), "0:1/S/TAG/T_START  1:4/S/TAG/T_NAME  4:5/S/TAG/ATT  5:8/S/TAG/ATT/A_NAME  8:9/S/TAG/ATT  9:10/S/TAG/ATT/EQ  10:11/S/TAG/ATT  11:15/S/TAG/ATT/TRUE  15:16/S/TAG/T_END", "foo = true");

        r = await parseContent('<div title="Hello">');
        assert.equal(lineInfo(r[0]), "0:1/S/TAG/T_START  1:4/S/TAG/T_NAME  4:5/S/TAG/ATT  5:10/S/TAG/ATT/A_NAME  10:11/S/TAG/ATT/EQ  11:12/S/TAG/ATT/STR_D/S_START  12:17/S/TAG/ATT/STR_D  17:18/S/TAG/ATT/STR_D/S_END  18:19/S/TAG/T_END", "<div title=\"Hello\">");

        r = await parseContent('<div title={1+2}>');
        assert.equal(lineInfo(r[0]), "0:1/S/TAG/T_START  1:4/S/TAG/T_NAME  4:5/S/TAG/ATT  5:10/S/TAG/ATT/A_NAME  10:11/S/TAG/ATT/EQ  11:12/S/TAG/ATT/BLOCK/B_DEF  12:13/S/TAG/ATT/BLOCK/NUM  13:14/S/TAG/ATT/BLOCK/OP  14:15/S/TAG/ATT/BLOCK/NUM  15:16/S/TAG/ATT/BLOCK/B_DEF  16:17/S/TAG/T_END", "<div title={1+2}>");

        r = await parseContent('<section title={::123}>');
        assert.equal(lineInfo(r[0]), "0:1/S/TAG/T_START  1:8/S/TAG/T_NAME  8:9/S/TAG/ATT  9:14/S/TAG/ATT/A_NAME  14:15/S/TAG/ATT/EQ  15:16/S/TAG/ATT/BLOCK/B_DEF  16:18/S/TAG/ATT/BLOCK/EXP_MOD  18:21/S/TAG/ATT/BLOCK/NUM  21:22/S/TAG/ATT/BLOCK/B_DEF  22:23/S/TAG/T_END", "<section title={::123}>");

        r = await parseContent('<div title={=abc.def}>');
        assert.equal(lineInfo(r[0]), "0:1/S/TAG/T_START  1:4/S/TAG/T_NAME  4:5/S/TAG/ATT  5:10/S/TAG/ATT/A_NAME  10:11/S/TAG/ATT/EQ  11:12/S/TAG/ATT/BLOCK/B_DEF  12:13/S/TAG/ATT/BLOCK/EXP_MOD  13:16/S/TAG/ATT/BLOCK/VAR  16:17/S/TAG/ATT/BLOCK/V_ACC  17:20/S/TAG/ATT/BLOCK/PROP  20:21/S/TAG/ATT/BLOCK/B_DEF  21:22/S/TAG/T_END", "<div title={=abc.def}>");

        r = await parseContent('<div click(e)={abc()}>');
        assert.equal(lineInfo(r[0]), "0:1/S/TAG/T_START  1:4/S/TAG/T_NAME  4:5/S/TAG/ATT  5:10/S/TAG/ATT/A_NAME  10:11/S/TAG/ATT/PARAM/P_START  11:12/S/TAG/ATT/PARAM/P_VAR  12:13/S/TAG/ATT/PARAM/P_END  13:14/S/TAG/ATT/EQ  14:15/S/TAG/ATT/BLOCK/B_DEF  15:18/S/TAG/ATT/BLOCK/F_CALL/F_NAME  18:19/S/TAG/ATT/BLOCK/BRACE.R  19:20/S/TAG/ATT/BLOCK/BRACE.R  20:21/S/TAG/ATT/BLOCK/B_DEF  21:22/S/TAG/T_END", "<div click(e)={abc()}>");
    });

    it("should support no-values attributes & decorators", async function () {
        let r: IToken[][];
        r = await parseContent('<div disabled>');
        assert.equal(lineInfo(r[0]), "0:1/S/TAG/T_START  1:4/S/TAG/T_NAME  4:5/S/TAG/ATT1  5:13/S/TAG/ATT1/A_NAME  13:14/S/TAG/T_END", "<div disabled>");

        r = await parseContent('<div @disabled>');
        assert.equal(lineInfo(r[0]), "0:1/S/TAG/T_START  1:4/S/TAG/T_NAME  4:5/S/TAG/DECO1  5:6/S/TAG/DECO1/D_DEF  6:14/S/TAG/DECO1/A_NAME  14:15/S/TAG/T_END", "<div @disabled>");
    });

    it("should support properties", async function () {
        let r: IToken[][];
        r = await parseContent('<div [className]="abc">');
        assert.equal(lineInfo(r[0]), "0:1/S/TAG/T_START  1:4/S/TAG/T_NAME  4:5/S/TAG  5:6/S/TAG/PR/PR_START  6:15/S/TAG/PR/A_NAME  15:16/S/TAG/PR/PR_END  16:17/S/TAG/PR/EQ  17:18/S/TAG/PR/STR_D/S_START  18:21/S/TAG/PR/STR_D  21:22/S/TAG/PR/STR_D/S_END  22:23/S/TAG/T_END", "<div [className]=\"abc\">");

        r = await parseContent('<div [className]={123}>');
        assert.equal(lineInfo(r[0]), "0:1/S/TAG/T_START  1:4/S/TAG/T_NAME  4:5/S/TAG  5:6/S/TAG/PR/PR_START  6:15/S/TAG/PR/A_NAME  15:16/S/TAG/PR/PR_END  16:17/S/TAG/PR/EQ  17:18/S/TAG/PR/BLOCK/B_DEF  18:21/S/TAG/PR/BLOCK/NUM  21:22/S/TAG/PR/BLOCK/B_DEF  22:23/S/TAG/T_END", "<div [className]={123}>");
    });

    it("should support ref attributes", async function () {
        let r: IToken[][];
        r = await parseContent('<div #name>');
        assert.equal(lineInfo(r[0]), "0:1/S/TAG/T_START  1:4/S/TAG/T_NAME  4:5/S/TAG/REF  5:6/S/TAG/REF/R_DEF  6:10/S/TAG/REF/A_NAME  10:11/S/TAG/T_END", "<div #name>");

        r = await parseContent('<div #names[]>');
        assert.equal(lineInfo(r[0]), "0:1/S/TAG/T_START  1:4/S/TAG/T_NAME  4:5/S/TAG/REF  5:6/S/TAG/REF/R_DEF  6:11/S/TAG/REF/A_NAME  11:13/S/TAG/REF/R_COL  13:14/S/TAG/T_END", "<div #names[]>");

        r = await parseContent('<div #names[{123}]>');
        assert.equal(lineInfo(r[0]), "0:1/S/TAG/T_START  1:4/S/TAG/T_NAME  4:5/S/TAG/REF  5:6/S/TAG/REF/R_DEF  6:11/S/TAG/REF/A_NAME  11:13/S/TAG/REF/R_COL_START  13:16/S/TAG/REF/NUM  16:18/S/TAG/REF/R_COL_END  18:19/S/TAG/T_END", "<div #names[123]>");
    });

    it("should support decorators with values", async function () {
        let r: IToken[][];
        r = await parseContent('<div @a.b = 123>');
        assert.equal(lineInfo(r[0]), "0:1/S/TAG/T_START  1:4/S/TAG/T_NAME  4:5/S/TAG/DECO  5:6/S/TAG/DECO/D_DEF  6:9/S/TAG/DECO/A_NAME  9:10/S/TAG/DECO  10:11/S/TAG/DECO/EQ  11:12/S/TAG/DECO  12:15/S/TAG/DECO/NUM  15:16/S/TAG/T_END", "<div @a.b = 123>");

        r = await parseContent('<div @foo={::123}>');
        assert.equal(lineInfo(r[0]), "0:1/S/TAG/T_START  1:4/S/TAG/T_NAME  4:5/S/TAG/DECO  5:6/S/TAG/DECO/D_DEF  6:9/S/TAG/DECO/A_NAME  9:10/S/TAG/DECO/EQ  10:11/S/TAG/DECO/BLOCK/B_DEF  11:13/S/TAG/DECO/BLOCK/EXP_MOD  13:16/S/TAG/DECO/BLOCK/NUM  16:17/S/TAG/DECO/BLOCK/B_DEF  17:18/S/TAG/T_END", "<div @foo={::123}>");

        r = await parseContent('<div @foo(a=1 @bcd disabled)>');
        assert.equal(lineInfo(r[0]), "0:1/S/TAG/T_START  1:4/S/TAG/T_NAME  4:5/S/TAG/DECO  5:6/S/TAG/DECO/D_DEF  6:9/S/TAG/DECO/A_NAME  9:10/S/TAG/DECO/D_START  10:11/S/TAG/DECO/ATT/A_NAME  11:12/S/TAG/DECO/ATT/EQ  12:13/S/TAG/DECO/ATT/NUM  13:14/S/TAG/DECO/ATT  14:15/S/TAG/DECO/DECO1/D_DEF  15:18/S/TAG/DECO/DECO1/A_NAME  18:19/S/TAG/DECO/ATT1  19:27/S/TAG/DECO/ATT1/A_NAME  27:28/S/TAG/DECO/D_END  28:29/S/TAG/T_END", "<div @foo(a=1 @bcd disabled)>");

        r = await parseContent('<div @foo(a={123})>');
        assert.equal(lineInfo(r[0]), "0:1/S/TAG/T_START  1:4/S/TAG/T_NAME  4:5/S/TAG/DECO  5:6/S/TAG/DECO/D_DEF  6:9/S/TAG/DECO/A_NAME  9:10/S/TAG/DECO/D_START  10:11/S/TAG/DECO/ATT/A_NAME  11:12/S/TAG/DECO/ATT/EQ  12:13/S/TAG/DECO/ATT/BLOCK/B_DEF  13:16/S/TAG/DECO/ATT/BLOCK/NUM  16:17/S/TAG/DECO/ATT/BLOCK/B_DEF  17:18/S/TAG/DECO/D_END  18:19/S/TAG/T_END", "<div @foo(a={123})>");
    });

    it("should support text nodes with attributes", async function () {
        let r: IToken[][];
        r = await parseContent('# (abc=123) Hello #');
        assert.equal(lineInfo(r[0]), "0:1/S/TXT/TXT_START  1:3/S/TXT/BLOCK/B_DEF  3:6/S/TXT/BLOCK/ATT/A_NAME  6:7/S/TXT/BLOCK/ATT/EQ  7:10/S/TXT/BLOCK/ATT/NUM  10:11/S/TXT/BLOCK/B_DEF  11:18/S/TXT  18:19/S/TXT/TXT_END", "# (abc=123) Hello #");
    });

    it("should support dynamic names for node, property nodes and attribute nodes", async function () {
        let r: IToken[][];
        r = await parseContent('<{getName()} />');
        assert.equal(lineInfo(r[0]), "0:1/S/TAG/T_START  1:2/S/TAG/BLOCK/B_DEF  2:9/S/TAG/BLOCK/F_CALL/F_NAME  9:10/S/TAG/BLOCK/BRACE.R  10:11/S/TAG/BLOCK/BRACE.R  11:12/S/TAG/BLOCK/B_DEF  12:13/S/TAG  13:15/S/TAG/T_END", "<{getName()} />");

        r = await parseContent('<.{propRef}/>');
        assert.equal(lineInfo(r[0]), "0:1/S/TAG/T_START  1:2/S/TAG/T_PREFIX  2:3/S/TAG/BLOCK/B_DEF  3:10/S/TAG/BLOCK/V_RW  10:11/S/TAG/BLOCK/B_DEF  11:13/S/TAG/T_END", "<.{propRef}/>");
    });
});