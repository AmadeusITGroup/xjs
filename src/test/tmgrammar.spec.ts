import * as assert from 'assert';
import { tokenize } from '../parser/tm-parser';
import { IToken } from 'vscode-textmate';
import { SCOPES } from '../parser/scopes';

describe('TextMate grammar', () => {

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
        r = await tokenize('<div>');
        assert.equal(lineInfo(r[0]), "0:1/S/TAG/T_START  1:4/S/TAG/T_NAME  4:5/S/TAG/T_END", "<div>");

        r = await tokenize('<span/>');
        assert.equal(lineInfo(r[0]), "0:1/S/TAG/T_START  1:5/S/TAG/T_NAME  5:6/S/TAG/T_CLOSE  6:7/S/TAG/T_END", "<span/>");

        r = await tokenize('<a-bcd /* comment */ />');
        assert.equal(lineInfo(r[0]), "0:1/S/TAG/T_START  1:6/S/TAG/T_NAME  6:7/S/TAG  7:9/S/TAG/COMMENT/C_DEF  9:18/S/TAG/COMMENT  18:20/S/TAG/COMMENT/C_DEF  20:21/S/TAG  21:22/S/TAG/T_CLOSE  22:23/S/TAG/T_END", "with comment");

        r = await tokenize('<*foo>');
        assert.equal(lineInfo(r[0]), "0:1/S/TAG/T_START  1:5/S/TAG/T_NAME  5:6/S/TAG/T_END", "<$foo>");

        r = await tokenize('<*foo.bar />');
        assert.equal(lineInfo(r[0]), "0:1/S/TAG/T_START  1:9/S/TAG/T_NAME  9:10/S/TAG  10:11/S/TAG/T_CLOSE  11:12/S/TAG/T_END", "<$foo.bar />");

        r = await tokenize('<.item/>');
        assert.equal(lineInfo(r[0]), "0:1/S/TAG/T_START  1:6/S/TAG/T_NAME  6:7/S/TAG/T_CLOSE  7:8/S/TAG/T_END", "<.item/>");

        r = await tokenize('<@abc.def>');
        assert.equal(lineInfo(r[0]), "0:1/S/TAG/T_START  1:9/S/TAG/T_NAME  9:10/S/TAG/T_END", "<@abc.def>");

        r = await tokenize('<!>');
        assert.equal(lineInfo(r[0]), "0:1/S/TAG/T_START  1:2/S/TAG/T_NAME  2:3/S/TAG/T_END", "<!>");

    });

    it("should support tag end", async function () {
        let r: IToken[][];
        r = await tokenize('</div>');
        assert.equal(lineInfo(r[0]), "0:1/S/TAG/T_START  1:2/S/TAG/T_CLOSE  2:5/S/TAG/T_NAME  5:6/S/TAG/T_END", "</div>");

        r = await tokenize('</>');
        assert.equal(lineInfo(r[0]), "0:1/S/TAG/T_START  1:2/S/TAG/T_CLOSE  2:3/S/TAG/T_END", "</div>");

        r = await tokenize('</!>');
        assert.equal(lineInfo(r[0]), "0:1/S/TAG/T_START  1:2/S/TAG/T_CLOSE  2:3/S/TAG/T_NAME  3:4/S/TAG/T_END", "</div>");

        r = await tokenize('</.propName>');
        assert.equal(lineInfo(r[0]), "0:1/S/TAG/T_START  1:2/S/TAG/T_CLOSE  2:11/S/TAG/T_NAME  11:12/S/TAG/T_END", "</div>");

        r = await tokenize('</@b.tooltip>');
        assert.equal(lineInfo(r[0]), "0:1/S/TAG/T_START  1:2/S/TAG/T_CLOSE  2:12/S/TAG/T_NAME  12:13/S/TAG/T_END", "</@b.tooltip>");
    });

    it("should support xml tag end", async function () {
        let r: IToken[][];
        r = await tokenize('</div>');
        assert.equal(lineInfo(r[0]), "0:1/S/TAG/T_START  1:2/S/TAG/T_CLOSE  2:5/S/TAG/T_NAME  5:6/S/TAG/T_END", "</div>");

        r = await tokenize('</! >');
        assert.equal(lineInfo(r[0]), "0:1/S/TAG/T_START  1:2/S/TAG/T_CLOSE  2:3/S/TAG/T_NAME  3:4/S/TAG  4:5/S/TAG/T_END", "</!>");

        r = await tokenize('</>');
        assert.equal(lineInfo(r[0]), "0:1/S/TAG/T_START  1:2/S/TAG/T_CLOSE  2:3/S/TAG/T_END", "</>");

        r = await tokenize('</*a.b.c> ');
        assert.equal(lineInfo(r[0]), "0:1/S/TAG/T_START  1:2/S/TAG/T_CLOSE  2:8/S/TAG/T_NAME  8:9/S/TAG/T_END  9:11/S", "</$a.b.c >"); // should be 9:10/S -> tm bug??
    });

    it("should support text nodes", async function () {
        let r: IToken[][];
        r = await tokenize('# Hello World #');
        assert.equal(lineInfo(r[0]), "0:1/S/TXT/TXT_START  1:14/S/TXT  14:15/S/TXT/TXT_END", "# Hello World #");

        r = await tokenize('# some text  \n on 2 lines with an escaped \\#! #');
        assert.equal(lineInfo(r[0]), "0:1/S/TXT/TXT_START  1:14/S/TXT", "multi line - line 0");
        assert.equal(lineInfo(r[1]), "0:28/S/TXT  28:30/S/TXT/ESC  30:32/S/TXT  32:33/S/TXT/TXT_END", "multi line - line 1");

        r = await tokenize('# &lt; &nbsp;&#160;#');
        assert.equal(lineInfo(r[0]), "0:1/S/TXT/TXT_START  1:2/S/TXT  2:6/S/TXT/ENTITY  6:7/S/TXT  7:13/S/TXT/ENTITY  13:19/S/TXT/ENTITY  19:20/S/TXT/TXT_END", "entities");

        r = await tokenize('# Hello {1+2} #');
        assert.equal(lineInfo(r[0]), "0:1/S/TXT/TXT_START  1:8/S/TXT  8:9/S/TXT/BLOCK/B_START  9:10/S/TXT/BLOCK/NUM  10:11/S/TXT/BLOCK/OP  11:12/S/TXT/BLOCK/NUM  12:13/S/TXT/BLOCK/B_END  13:14/S/TXT  14:15/S/TXT/TXT_END", "# Hello {1+2} #");
    });

    it("should support attributes", async function () {
        let r: IToken[][];
        r = await tokenize('<div foo=123>');
        assert.equal(lineInfo(r[0]), "0:1/S/TAG/T_START  1:4/S/TAG/T_NAME  4:5/S/TAG/ATT  5:8/S/TAG/ATT/A_NAME  8:9/S/TAG/ATT/EQ  9:12/S/TAG/ATT/NUM  12:13/S/TAG/T_END", "foo=123");

        r = await tokenize('<div bar = true>');
        assert.equal(lineInfo(r[0]), "0:1/S/TAG/T_START  1:4/S/TAG/T_NAME  4:5/S/TAG/ATT  5:8/S/TAG/ATT/A_NAME  8:9/S/TAG/ATT  9:10/S/TAG/ATT/EQ  10:11/S/TAG/ATT  11:15/S/TAG/ATT/TRUE  15:16/S/TAG/T_END", "foo = true");

        r = await tokenize('<div title="Hello">');
        assert.equal(lineInfo(r[0]), "0:1/S/TAG/T_START  1:4/S/TAG/T_NAME  4:5/S/TAG/ATT  5:10/S/TAG/ATT/A_NAME  10:11/S/TAG/ATT/EQ  11:12/S/TAG/ATT/STR_D/S_START  12:17/S/TAG/ATT/STR_D  17:18/S/TAG/ATT/STR_D/S_END  18:19/S/TAG/T_END", "<div title=\"Hello\">");

        r = await tokenize('<div title={1+2}>');
        assert.equal(lineInfo(r[0]), "0:1/S/TAG/T_START  1:4/S/TAG/T_NAME  4:5/S/TAG/ATT  5:10/S/TAG/ATT/A_NAME  10:11/S/TAG/ATT/EQ  11:12/S/TAG/ATT/BLOCK/B_START  12:13/S/TAG/ATT/BLOCK/NUM  13:14/S/TAG/ATT/BLOCK/OP  14:15/S/TAG/ATT/BLOCK/NUM  15:16/S/TAG/ATT/BLOCK/B_END  16:17/S/TAG/T_END", "<div title={1+2}>");

        r = await tokenize('<section title={::123}>');
        assert.equal(lineInfo(r[0]), "0:1/S/TAG/T_START  1:8/S/TAG/T_NAME  8:9/S/TAG/ATT  9:14/S/TAG/ATT/A_NAME  14:15/S/TAG/ATT/EQ  15:16/S/TAG/ATT/BLOCK/B_START  16:18/S/TAG/ATT/BLOCK/EXP_MOD  18:21/S/TAG/ATT/BLOCK/NUM  21:22/S/TAG/ATT/BLOCK/B_END  22:23/S/TAG/T_END", "<section title={::123}>");

        r = await tokenize('<div title={=abc.def}>');
        assert.equal(lineInfo(r[0]), "0:1/S/TAG/T_START  1:4/S/TAG/T_NAME  4:5/S/TAG/ATT  5:10/S/TAG/ATT/A_NAME  10:11/S/TAG/ATT/EQ  11:12/S/TAG/ATT/BLOCK/B_START  12:13/S/TAG/ATT/BLOCK/EXP_MOD  13:16/S/TAG/ATT/BLOCK/VAR  16:17/S/TAG/ATT/BLOCK/V_ACC  17:20/S/TAG/ATT/BLOCK/PROP  20:21/S/TAG/ATT/BLOCK/B_END  21:22/S/TAG/T_END", "<div title={=abc.def}>");
    });

    it("should support no-values attributes & decorators", async function () {
        let r: IToken[][];
        r = await tokenize('<div disabled>');
        assert.equal(lineInfo(r[0]), "0:1/S/TAG/T_START  1:4/S/TAG/T_NAME  4:5/S/TAG/ATT1  5:13/S/TAG/ATT1/A_NAME  13:14/S/TAG/T_END", "<div disabled>");

        r = await tokenize('<div @disabled>');
        assert.equal(lineInfo(r[0]), "0:1/S/TAG/T_START  1:4/S/TAG/T_NAME  4:5/S/TAG/DECO1  5:6/S/TAG/DECO1/D_DEF  6:14/S/TAG/DECO1/A_NAME  14:15/S/TAG/T_END", "<div @disabled>");
    });

    it("should support properties", async function () {
        let r: IToken[][];
        r = await tokenize('<div [className]="abc">');
        assert.equal(lineInfo(r[0]), "0:1/S/TAG/T_START  1:4/S/TAG/T_NAME  4:5/S/TAG  5:6/S/TAG/PR/PR_START  6:15/S/TAG/PR/A_NAME  15:16/S/TAG/PR/PR_END  16:17/S/TAG/PR/EQ  17:18/S/TAG/PR/STR_D/S_START  18:21/S/TAG/PR/STR_D  21:22/S/TAG/PR/STR_D/S_END  22:23/S/TAG/T_END", "<div [className]=\"abc\">");

        r = await tokenize('<div [className]={123}>');
        assert.equal(lineInfo(r[0]), "0:1/S/TAG/T_START  1:4/S/TAG/T_NAME  4:5/S/TAG  5:6/S/TAG/PR/PR_START  6:15/S/TAG/PR/A_NAME  15:16/S/TAG/PR/PR_END  16:17/S/TAG/PR/EQ  17:18/S/TAG/PR/BLOCK/B_START  18:21/S/TAG/PR/BLOCK/NUM  21:22/S/TAG/PR/BLOCK/B_END  22:23/S/TAG/T_END", "<div [className]={123}>");
    });

    it("should support ref attributes", async function () {
        let r: IToken[][];
        r = await tokenize('<div #name>');
        assert.equal(lineInfo(r[0]), "0:1/S/TAG/T_START  1:4/S/TAG/T_NAME  4:5/S/TAG/LBL  5:6/S/TAG/LBL/LBL_DEF  6:10/S/TAG/LBL/A_NAME  10:11/S/TAG/T_END", "<div #name>");

        r = await tokenize('<div ##name>');
        assert.equal(lineInfo(r[0]), "0:1/S/TAG/T_START  1:4/S/TAG/T_NAME  4:5/S/TAG/LBL  5:7/S/TAG/LBL/LBL_DEF  7:11/S/TAG/LBL/A_NAME  11:12/S/TAG/T_END", "<div ##name>");
    });

    it("should support decorators with values", async function () {
        let r: IToken[][];
        r = await tokenize('<div @a.b = 123>');
        assert.equal(lineInfo(r[0]), "0:1/S/TAG/T_START  1:4/S/TAG/T_NAME  4:5/S/TAG/DECO  5:6/S/TAG/DECO/D_DEF  6:9/S/TAG/DECO/A_NAME  9:10/S/TAG/DECO  10:11/S/TAG/DECO/EQ  11:12/S/TAG/DECO  12:15/S/TAG/DECO/NUM  15:16/S/TAG/T_END", "<div @a.b = 123>");

        r = await tokenize('<div @foo={::123}>');
        assert.equal(lineInfo(r[0]), "0:1/S/TAG/T_START  1:4/S/TAG/T_NAME  4:5/S/TAG/DECO  5:6/S/TAG/DECO/D_DEF  6:9/S/TAG/DECO/A_NAME  9:10/S/TAG/DECO/EQ  10:11/S/TAG/DECO/BLOCK/B_START  11:13/S/TAG/DECO/BLOCK/EXP_MOD  13:16/S/TAG/DECO/BLOCK/NUM  16:17/S/TAG/DECO/BLOCK/B_END  17:18/S/TAG/T_END", "<div @foo={::123}>");

        r = await tokenize('<div @foo(a=1 @bcd disabled)>');
        assert.equal(lineInfo(r[0]), "0:1/S/TAG/T_START  1:4/S/TAG/T_NAME  4:5/S/TAG/DECO  5:6/S/TAG/DECO/D_DEF  6:9/S/TAG/DECO/A_NAME  9:10/S/TAG/DECO/D_START  10:11/S/TAG/DECO/ATT/A_NAME  11:12/S/TAG/DECO/ATT/EQ  12:13/S/TAG/DECO/ATT/NUM  13:14/S/TAG/DECO/ATT  14:15/S/TAG/DECO/DECO1/D_DEF  15:18/S/TAG/DECO/DECO1/A_NAME  18:19/S/TAG/DECO/ATT1  19:27/S/TAG/DECO/ATT1/A_NAME  27:28/S/TAG/DECO/D_END  28:29/S/TAG/T_END", "<div @foo(a=1 @bcd disabled)>");

        r = await tokenize('<div @foo(a={123})>');
        assert.equal(lineInfo(r[0]), "0:1/S/TAG/T_START  1:4/S/TAG/T_NAME  4:5/S/TAG/DECO  5:6/S/TAG/DECO/D_DEF  6:9/S/TAG/DECO/A_NAME  9:10/S/TAG/DECO/D_START  10:11/S/TAG/DECO/ATT/A_NAME  11:12/S/TAG/DECO/ATT/EQ  12:13/S/TAG/DECO/ATT/BLOCK/B_START  13:16/S/TAG/DECO/ATT/BLOCK/NUM  16:17/S/TAG/DECO/ATT/BLOCK/B_END  17:18/S/TAG/DECO/D_END  18:19/S/TAG/T_END", "<div @foo(a={123})>");
    });

    it("should support text nodes with attributes", async function () {
        let r: IToken[][];
        r = await tokenize('# (abc=123) Hello #');
        assert.equal(lineInfo(r[0]), "0:1/S/TXT/TXT_START  1:3/S/TXT/BLOCK_ATT/B_START  3:6/S/TXT/BLOCK_ATT/ATT/A_NAME  6:7/S/TXT/BLOCK_ATT/ATT/EQ  7:10/S/TXT/BLOCK_ATT/ATT/NUM  10:11/S/TXT/BLOCK_ATT/B_END  11:18/S/TXT  18:19/S/TXT/TXT_END", "# (abc=123) Hello #");
    });

    it("should support dynamic names for node, property nodes and attribute nodes", async function () {
        let r: IToken[][];
        r = await tokenize('<{getName()} />');
        assert.equal(lineInfo(r[0]), "0:1/S/TAG/T_START  1:2/S/TAG/BLOCK/B_START  2:9/S/TAG/BLOCK/F_CALL/F_NAME  9:10/S/TAG/BLOCK/BRACE_R  10:11/S/TAG/BLOCK/BRACE_R  11:12/S/TAG/BLOCK/B_END  12:13/S/TAG  13:14/S/TAG/T_CLOSE  14:15/S/TAG/T_END", "<{getName()} />");

        r = await tokenize('<.{propRef}/>');
        assert.equal(lineInfo(r[0]), "0:1/S/TAG/T_START  1:2/S/TAG/T_PREFIX  2:3/S/TAG/BLOCK/B_START  3:10/S/TAG/BLOCK/V_RW  10:11/S/TAG/BLOCK/B_END  11:12/S/TAG/T_CLOSE  12:13/S/TAG/T_END", "<.{propRef}/>");
    });
});