import * as vsTM from 'vscode-textmate';
import { IToken } from 'vscode-textmate';
import * as path from 'path';
import * as fs from 'fs';
import { SCOPES } from './scopes';
import * as assert from 'assert';

const XJS_GRAMMAR_PATH = "../../../syntaxes/xjs.tmLanguage.json";

const XJS_REGISTRY = new vsTM.Registry({
    loadGrammar: async function () {
        const g = await fs.promises.readFile(path.join(__dirname, XJS_GRAMMAR_PATH), { encoding: 'utf8' });
        return vsTM.parseRawGrammar(g, 'xjs.tmLanguage.json');
    }
});

describe('XJS TextMate grammar', async () => {
    let xjsGrammar: vsTM.IGrammar | null | undefined;

    async function tokenize(src: string): Promise<vsTM.IToken[][]> {
        if (!xjsGrammar) {
            xjsGrammar = await XJS_REGISTRY.loadGrammar("source.ts");
        }

        let ruleStack: vsTM.StackElement | undefined, lines = src.split("\n"), result: vsTM.IToken[][] = [];
        for (let i = 0; i < lines.length; i++) {
            const r = xjsGrammar!.tokenizeLine(lines[i], <any>ruleStack);
            result.push(r.tokens);
            ruleStack = r.ruleStack;
        }
        return result;
    }

    async function tokenizeTemplate(src: string): Promise<vsTM.IToken[][]> {
        return tokenize('$template`()=> {\n' + src + '\n}');
    }

    async function tokenizeContent(src: string): Promise<vsTM.IToken[][]> {
        return tokenize('$content`\n' + src + '\n');
    }

    function lineInfo(tokens: IToken[]) {
        let r: string[] = [], len = tokens.length, t: IToken, scope: string[], val: string;
        for (let i = 0; len > i; i++) {
            t = tokens[i];
            scope = [];
            for (let j = 0; t.scopes.length > j; j++) {
                val = SCOPES[t.scopes[j]]
                if (j === 0 && val === "S") continue; // to simplify the output
                if (j === 1 && val === "T") continue; // to simplify the output
                if (j === 2 && val === "BLOCK") continue; // to simplify the output
                scope.push(SCOPES[t.scopes[j]] || t.scopes[j]);
            }
            r.push(`${t.startIndex}:${t.endIndex}/${scope.join("/")}`);
        }
        return r.join("  ");
    }

    it("should support xml tag start", async function () {
        let r: IToken[][];
        r = await tokenizeTemplate('<div>');
        assert.equal(lineInfo(r[1]), "0:1/TAG/T_START  1:4/TAG/T_NAME  4:5/TAG/T_END", "<div>");

        r = await tokenizeTemplate('<span/>');
        assert.equal(lineInfo(r[1]), "0:1/TAG/T_START  1:5/TAG/T_NAME  5:6/TAG/T_CLOSE  6:7/TAG/T_END", "<span/>");

        r = await tokenizeTemplate('<a-bcd /* comment */ />');
        assert.equal(lineInfo(r[1]), "0:1/TAG/T_START  1:6/TAG/T_NAME  6:7/TAG  7:9/TAG/COMMENT/C_DEF  9:18/TAG/COMMENT  18:20/TAG/COMMENT/C_DEF  20:21/TAG  21:22/TAG/T_CLOSE  22:23/TAG/T_END", "with comment");

        r = await tokenizeTemplate('<*foo>');
        assert.equal(lineInfo(r[1]), "0:1/TAG/T_START  1:5/TAG/T_NAME  5:6/TAG/T_END", "<$foo>");

        r = await tokenizeTemplate('<*foo.bar />');
        assert.equal(lineInfo(r[1]), "0:1/TAG/T_START  1:9/TAG/T_NAME  9:10/TAG  10:11/TAG/T_CLOSE  11:12/TAG/T_END", "<$foo.bar />");

        r = await tokenizeTemplate('<.item/>');
        assert.equal(lineInfo(r[1]), "0:1/TAG/T_START  1:6/TAG/T_NAME  6:7/TAG/T_CLOSE  7:8/TAG/T_END", "<.item/>");

        r = await tokenizeTemplate('<@abc.def>');
        assert.equal(lineInfo(r[1]), "0:1/TAG/T_START  1:9/TAG/T_NAME  9:10/TAG/T_END", "<@abc.def>");

        r = await tokenizeTemplate('<!>');
        assert.equal(lineInfo(r[1]), "0:1/TAG/T_START  1:2/TAG/T_NAME  2:3/TAG/T_END", "<!>");
    });

    it("should support tag end", async function () {
        let r: IToken[][];
        r = await tokenizeTemplate('</div>');
        assert.equal(lineInfo(r[1]), "0:1/TAG/T_START  1:2/TAG/T_CLOSE  2:5/TAG/T_NAME  5:6/TAG/T_END", "</div>");

        r = await tokenizeTemplate('</>');
        assert.equal(lineInfo(r[1]), "0:1/TAG/T_START  1:2/TAG/T_CLOSE  2:3/TAG/T_END", "</div>");

        r = await tokenizeTemplate('</!>');
        assert.equal(lineInfo(r[1]), "0:1/TAG/T_START  1:2/TAG/T_CLOSE  2:3/TAG/T_NAME  3:4/TAG/T_END", "</div>");

        r = await tokenizeTemplate('</.propName>');
        assert.equal(lineInfo(r[1]), "0:1/TAG/T_START  1:2/TAG/T_CLOSE  2:11/TAG/T_NAME  11:12/TAG/T_END", "</div>");

        r = await tokenizeTemplate('</@b.tooltip>');
        assert.equal(lineInfo(r[1]), "0:1/TAG/T_START  1:2/TAG/T_CLOSE  2:12/TAG/T_NAME  12:13/TAG/T_END", "</@b.tooltip>");
    });

    it("should support xml tag end", async function () {
        let r: IToken[][];
        r = await tokenizeTemplate('</div>');
        assert.equal(lineInfo(r[1]), "0:1/TAG/T_START  1:2/TAG/T_CLOSE  2:5/TAG/T_NAME  5:6/TAG/T_END", "</div>");

        r = await tokenizeTemplate('</! >');
        assert.equal(lineInfo(r[1]), "0:1/TAG/T_START  1:2/TAG/T_CLOSE  2:3/TAG/T_NAME  3:4/TAG  4:5/TAG/T_END", "</!>");

        r = await tokenizeTemplate('</>');
        assert.equal(lineInfo(r[1]), "0:1/TAG/T_START  1:2/TAG/T_CLOSE  2:3/TAG/T_END", "</>");

        r = await tokenizeTemplate('</*a.b.c> ');
        assert.equal(lineInfo(r[1]), "0:1/TAG/T_START  1:2/TAG/T_CLOSE  2:8/TAG/T_NAME  8:9/TAG/T_END  9:11/", "</$a.b.c >"); // should be 9:10/S -> tm bug??
    });

    it("should support text nodes", async function () {
        let r: IToken[][];
        r = await tokenizeTemplate(' Hello World ');
        assert.equal(lineInfo(r[1]), "0:14/", "1");

        r = await tokenizeTemplate('!< and !> and !{ and !} and !s and !n and !! and !$ and !z and !/ and !_');
        assert.equal(lineInfo(r[1]), "0:2/ESC  2:7/  7:9/ESC  9:14/  14:16/ESC  16:21/  21:23/ESC  23:28/  28:30/ESC  30:35/  35:37/ESC  37:42/  42:44/ESC  44:49/  49:51/ESC  51:56/  56:58/ESC  58:63/  63:65/ESC  65:70/  70:72/ESC", "2");

        r = await tokenizeTemplate('abc /* comment */ def');
        assert.equal(lineInfo(r[1]), "0:4/  4:6/COMMENT/C_DEF  6:15/COMMENT  15:17/COMMENT/C_DEF  17:22/", "3");

        r = await tokenizeTemplate('abc /* comment\ncomment */ def');
        assert.equal(lineInfo(r[1]), "0:4/  4:6/COMMENT/C_DEF  6:15/COMMENT", "4.1");
        assert.equal(lineInfo(r[2]), "0:8/COMMENT  8:10/COMMENT/C_DEF  10:15/", "4.2");

        r = await tokenizeTemplate('abc // comment\ndef');
        assert.equal(lineInfo(r[1]), "0:4/  4:6/COMMENT1/C_DEF  6:14/COMMENT1", "5.1");
        assert.equal(lineInfo(r[2]), "0:4/", "5.2");

        r = await tokenizeTemplate('Hello {expr()+42} World');
        assert.equal(lineInfo(r[1]), "0:6/  6:7/BLOCK/T_EXP  7:11/BLOCK/F_CALL/F_NAME  11:12/BLOCK/BRACE_R  12:13/BLOCK/BRACE_R  13:14/BLOCK/OP  14:16/BLOCK/NUM  16:17/BLOCK/T_EXP  17:24/", "6");

        r = await tokenizeTemplate(' !{no expr!} ');
        assert.equal(lineInfo(r[1]), "0:1/  1:3/ESC  3:10/  10:12/ESC  12:14/", "7");

        r = await tokenizeTemplate('&lt; &nbsp; &#160;');
        assert.equal(lineInfo(r[1]), "0:19/", "8");
    });

    it("should support attributes", async function () {
        let r: IToken[][];
        r = await tokenizeTemplate('<div foo=123>');
        assert.equal(lineInfo(r[1]), "0:1/TAG/T_START  1:4/TAG/T_NAME  4:5/TAG/ATT  5:8/TAG/ATT/A_NAME  8:9/TAG/ATT/EQ  9:12/TAG/ATT/NUM  12:13/TAG/T_END", "foo=123");

        r = await tokenizeTemplate('<div bar = true>');
        assert.equal(lineInfo(r[1]), "0:1/TAG/T_START  1:4/TAG/T_NAME  4:5/TAG/ATT  5:8/TAG/ATT/A_NAME  8:9/TAG/ATT  9:10/TAG/ATT/EQ  10:11/TAG/ATT  11:15/TAG/ATT/TRUE  15:16/TAG/T_END", "foo = true");

        r = await tokenizeTemplate('<div title="Hello">');
        assert.equal(lineInfo(r[1]), "0:1/TAG/T_START  1:4/TAG/T_NAME  4:5/TAG/ATT  5:10/TAG/ATT/A_NAME  10:11/TAG/ATT/EQ  11:12/TAG/ATT/STR_D/S_START  12:17/TAG/ATT/STR_D  17:18/TAG/ATT/STR_D/S_END  18:19/TAG/T_END", "<div title=\"Hello\">");

        r = await tokenizeTemplate('<div title={1+2}>');
        assert.equal(lineInfo(r[1]), "0:1/TAG/T_START  1:4/TAG/T_NAME  4:5/TAG/ATT  5:10/TAG/ATT/A_NAME  10:11/TAG/ATT/EQ  11:12/TAG/ATT/BLOCK/B_START  12:13/TAG/ATT/BLOCK/NUM  13:14/TAG/ATT/BLOCK/OP  14:15/TAG/ATT/BLOCK/NUM  15:16/TAG/ATT/BLOCK/B_END  16:17/TAG/T_END", "<div title={1+2}>");

        r = await tokenizeTemplate('<section title={::123}>');
        assert.equal(lineInfo(r[1]), "0:1/TAG/T_START  1:8/TAG/T_NAME  8:9/TAG/ATT  9:14/TAG/ATT/A_NAME  14:15/TAG/ATT/EQ  15:16/TAG/ATT/BLOCK/B_START  16:18/TAG/ATT/BLOCK/EXP_MOD  18:21/TAG/ATT/BLOCK/NUM  21:22/TAG/ATT/BLOCK/B_END  22:23/TAG/T_END", "<section title={::123}>");

        r = await tokenizeTemplate('<div title={=abc.def}>');
        assert.equal(lineInfo(r[1]), "0:1/TAG/T_START  1:4/TAG/T_NAME  4:5/TAG/ATT  5:10/TAG/ATT/A_NAME  10:11/TAG/ATT/EQ  11:12/TAG/ATT/BLOCK/B_START  12:13/TAG/ATT/BLOCK/EXP_MOD  13:16/TAG/ATT/BLOCK/VAR  16:17/TAG/ATT/BLOCK/V_ACC  17:20/TAG/ATT/BLOCK/PROP  20:21/TAG/ATT/BLOCK/B_END  21:22/TAG/T_END", "<div title={=abc.def}>");
    });

    it("should support no-values attributes & decorators", async function () {
        let r: IToken[][];
        r = await tokenizeTemplate('<div disabled>');
        assert.equal(lineInfo(r[1]), "0:1/TAG/T_START  1:4/TAG/T_NAME  4:5/TAG/ATT1  5:13/TAG/ATT1/A_NAME  13:14/TAG/T_END", "<div disabled>");

        r = await tokenizeTemplate('<div @disabled>');
        assert.equal(lineInfo(r[1]), "0:1/TAG/T_START  1:4/TAG/T_NAME  4:5/TAG/DECO1  5:6/TAG/DECO1/D_DEF  6:14/TAG/DECO1/A_NAME  14:15/TAG/T_END", "<div @disabled>");
    });

    it("should support properties", async function () {
        let r: IToken[][];
        r = await tokenizeTemplate('<div [className]="abc">');
        assert.equal(lineInfo(r[1]), "0:1/TAG/T_START  1:4/TAG/T_NAME  4:5/TAG  5:6/TAG/PR/PR_START  6:15/TAG/PR/A_NAME  15:16/TAG/PR/PR_END  16:17/TAG/PR/EQ  17:18/TAG/PR/STR_D/S_START  18:21/TAG/PR/STR_D  21:22/TAG/PR/STR_D/S_END  22:23/TAG/T_END", "<div [className]=\"abc\">");

        r = await tokenizeTemplate('<div [className]={123}>');
        assert.equal(lineInfo(r[1]), "0:1/TAG/T_START  1:4/TAG/T_NAME  4:5/TAG  5:6/TAG/PR/PR_START  6:15/TAG/PR/A_NAME  15:16/TAG/PR/PR_END  16:17/TAG/PR/EQ  17:18/TAG/PR/BLOCK/B_START  18:21/TAG/PR/BLOCK/NUM  21:22/TAG/PR/BLOCK/B_END  22:23/TAG/T_END", "<div [className]={123}>");
    });

    it("should support ref attributes", async function () {
        let r: IToken[][];
        r = await tokenizeTemplate('<div #name>');
        assert.equal(lineInfo(r[1]), "0:1/TAG/T_START  1:4/TAG/T_NAME  4:5/TAG/LBL  5:6/TAG/LBL/LBL_DEF  6:10/TAG/LBL/A_NAME  10:11/TAG/T_END", "<div #name>");

        r = await tokenizeTemplate('<div ##name>');
        assert.equal(lineInfo(r[1]), "0:1/TAG/T_START  1:4/TAG/T_NAME  4:5/TAG/LBL  5:7/TAG/LBL/LBL_DEF  7:11/TAG/LBL/A_NAME  11:12/TAG/T_END", "<div ##name>");
    });

    it("should support decorators with values", async function () {
        let r: IToken[][];
        r = await tokenizeTemplate('<div @a.b = 123>');
        assert.equal(lineInfo(r[1]), "0:1/TAG/T_START  1:4/TAG/T_NAME  4:5/TAG/DECO  5:6/TAG/DECO/D_DEF  6:9/TAG/DECO/A_NAME  9:10/TAG/DECO  10:11/TAG/DECO/EQ  11:12/TAG/DECO  12:15/TAG/DECO/NUM  15:16/TAG/T_END", "<div @a.b = 123>");

        r = await tokenizeTemplate('<div @foo={::123}>');
        assert.equal(lineInfo(r[1]), "0:1/TAG/T_START  1:4/TAG/T_NAME  4:5/TAG/DECO  5:6/TAG/DECO/D_DEF  6:9/TAG/DECO/A_NAME  9:10/TAG/DECO/EQ  10:11/TAG/DECO/BLOCK/B_START  11:13/TAG/DECO/BLOCK/EXP_MOD  13:16/TAG/DECO/BLOCK/NUM  16:17/TAG/DECO/BLOCK/B_END  17:18/TAG/T_END", "<div @foo={::123}>");

        r = await tokenizeTemplate('<div @foo(a=1 @bcd disabled)>');
        assert.equal(lineInfo(r[1]), "0:1/TAG/T_START  1:4/TAG/T_NAME  4:5/TAG/DECO  5:6/TAG/DECO/D_DEF  6:9/TAG/DECO/A_NAME  9:10/TAG/DECO/D_START  10:11/TAG/DECO/ATT/A_NAME  11:12/TAG/DECO/ATT/EQ  12:13/TAG/DECO/ATT/NUM  13:14/TAG/DECO/ATT  14:15/TAG/DECO/DECO1/D_DEF  15:18/TAG/DECO/DECO1/A_NAME  18:19/TAG/DECO/ATT1  19:27/TAG/DECO/ATT1/A_NAME  27:28/TAG/DECO/D_END  28:29/TAG/T_END", "<div @foo(a=1 @bcd disabled)>");

        r = await tokenizeTemplate('<div @foo(a={123})>');
        assert.equal(lineInfo(r[1]), "0:1/TAG/T_START  1:4/TAG/T_NAME  4:5/TAG/DECO  5:6/TAG/DECO/D_DEF  6:9/TAG/DECO/A_NAME  9:10/TAG/DECO/D_START  10:11/TAG/DECO/ATT/A_NAME  11:12/TAG/DECO/ATT/EQ  12:13/TAG/DECO/ATT/BLOCK/B_START  13:16/TAG/DECO/ATT/BLOCK/NUM  16:17/TAG/DECO/ATT/BLOCK/B_END  17:18/TAG/DECO/D_END  18:19/TAG/T_END", "<div @foo(a={123})>");
    });

    it("should support $if js statements", async function () {
        let r: IToken[][];
        r = await tokenizeTemplate('$if (val) { Hello World }');
        assert.equal(lineInfo(r[1]), "0:3/$IF/$if  3:4/$IF  4:5/$IF/BRACE_R  5:8/$IF/V_RW  8:9/$IF/BRACE_R  9:10/$IF  10:11/$IF/BLOCK/B  11:24/$IF/BLOCK  24:25/$IF/BLOCK/B", "1");

        r = await tokenizeTemplate('$if (val) {\n Hello <b>World</b> \n}');
        assert.equal(lineInfo(r[1]), "0:3/$IF/$if  3:4/$IF  4:5/$IF/BRACE_R  5:8/$IF/V_RW  8:9/$IF/BRACE_R  9:10/$IF  10:11/$IF/BLOCK/B", "2.1");
        assert.equal(lineInfo(r[2]), "0:7/$IF/BLOCK  7:8/$IF/BLOCK/TAG/T_START  8:9/$IF/BLOCK/TAG/T_NAME  9:10/$IF/BLOCK/TAG/T_END  10:15/$IF/BLOCK  15:16/$IF/BLOCK/TAG/T_START  16:17/$IF/BLOCK/TAG/T_CLOSE  17:18/$IF/BLOCK/TAG/T_NAME  18:19/$IF/BLOCK/TAG/T_END  19:21/$IF/BLOCK", "2.2");
        assert.equal(lineInfo(r[3]), "0:1/$IF/BLOCK/B", "2.3");

        r = await tokenizeTemplate('!$if (val)');
        assert.equal(lineInfo(r[1]), "0:2/ESC  2:11/", "3");

        r = await tokenizeTemplate('$if (val) {\n aaa \n} else if (otherVal) {\n bbb \n} else {\n ccc \n}');
        assert.equal(lineInfo(r[1]), "0:3/$IF/$if  3:4/$IF  4:5/$IF/BRACE_R  5:8/$IF/V_RW  8:9/$IF/BRACE_R  9:10/$IF  10:11/$IF/BLOCK/B", "4.1");
        assert.equal(lineInfo(r[2]), "0:6/$IF/BLOCK", "4.2");
        assert.equal(lineInfo(r[3]), "0:1/$IF/BLOCK/B  1:9/$IF/$if  9:10/$IF  10:11/$IF/BRACE_R  11:19/$IF/V_RW  19:20/$IF/BRACE_R  20:21/$IF  21:22/$IF/BLOCK/B", "4.3");
        assert.equal(lineInfo(r[4]), "0:6/$IF/BLOCK", "4.4");
        assert.equal(lineInfo(r[5]), "0:1/$IF/BLOCK/B  1:2/$IF  2:6/$IF/$if  6:7/$IF  7:8/$IF/BLOCK/B", "4.5");
        assert.equal(lineInfo(r[6]), "0:6/$IF/BLOCK", "4.6");
        assert.equal(lineInfo(r[7]), "0:1/$IF/BLOCK/B", "4.7");
    });

    it("should support $for js statements", async function () {
        let r: IToken[][];
        r = await tokenizeTemplate('$for (let i=0;10>i;i++) {hi <br/>}');
        assert.equal(lineInfo(r[1]), "0:4/$FR/$for  4:5/$FR  5:6/$FR/BRACE_R  6:9/$FR/VE/STT  9:10/$FR/VE  10:11/$FR/VE/VSVE/VDF/V_RW  11:12/$FR/VE/ASSIGNMENT  12:13/$FR/VE/NUM  13:14/$FR/TERM  14:16/$FR/NUM  16:17/$FR/OP  17:18/$FR/V_RW  18:19/$FR/TERM  19:20/$FR/V_RW  20:22/$FR/++  22:23/$FR/BRACE_R  23:24/$FR  24:25/$FR/BLOCK/B  25:28/$FR/BLOCK  28:29/$FR/BLOCK/TAG/T_START  29:31/$FR/BLOCK/TAG/T_NAME  31:32/$FR/BLOCK/TAG/T_CLOSE  32:33/$FR/BLOCK/TAG/T_END  33:34/$FR/BLOCK/B", "1");

        r = await tokenizeTemplate('$for (let i=0;10>i;i++) {\nhi <br/>\n}abc');
        assert.equal(lineInfo(r[1]), "0:4/$FR/$for  4:5/$FR  5:6/$FR/BRACE_R  6:9/$FR/VE/STT  9:10/$FR/VE  10:11/$FR/VE/VSVE/VDF/V_RW  11:12/$FR/VE/ASSIGNMENT  12:13/$FR/VE/NUM  13:14/$FR/TERM  14:16/$FR/NUM  16:17/$FR/OP  17:18/$FR/V_RW  18:19/$FR/TERM  19:20/$FR/V_RW  20:22/$FR/++  22:23/$FR/BRACE_R  23:24/$FR  24:25/$FR/BLOCK/B", "2.1");
        assert.equal(lineInfo(r[2]), "0:3/$FR/BLOCK  3:4/$FR/BLOCK/TAG/T_START  4:6/$FR/BLOCK/TAG/T_NAME  6:7/$FR/BLOCK/TAG/T_CLOSE  7:8/$FR/BLOCK/TAG/T_END", "2.2");
        assert.equal(lineInfo(r[3]), "0:1/$FR/BLOCK/B  1:5/", "2.3");

        r = await tokenizeTemplate('!$for (let i=0;10>i;i++)');
        assert.equal(lineInfo(r[1]), "0:2/ESC  2:25/", "3");
    });

    it("should support $exec js statements", async function () {
        let r: IToken[][];
        r = await tokenizeTemplate('$exec foo.bar("abc"); hello');
        assert.equal(lineInfo(r[1]), "0:5/$E/$exec  5:6/$E  6:9/$E/F_CALL/VAR  9:10/$E/F_CALL/V_ACC  10:13/$E/F_CALL/F_NAME  13:14/$E/BRACE_R  14:15/$E/STR_D/S_START  15:18/$E/STR_D  18:19/$E/STR_D/S_END  19:20/$E/BRACE_R  20:21/$E/TERM  21:28/", "1");

        r = await tokenizeTemplate('!$exec foo.bar;');
        assert.equal(lineInfo(r[1]), "0:2/ESC  2:16/", "2");
    });

    it("should support $let js statements", async function () {
        let r: IToken[][];
        r = await tokenizeTemplate('$let x;abc');
        assert.equal(lineInfo(r[1]), "0:4/VE/$let  4:5/VE  5:6/VE/VSVE/VDF/V_RW  6:7/VE/TERM  7:11/", "1");

        r = await tokenizeTemplate('$let x=123;');
        assert.equal(lineInfo(r[1]), "0:4/VE/$let  4:5/VE  5:6/VE/VSVE/VDF/V_RW  6:7/VE/ASSIGNMENT  7:10/VE/NUM  10:11/VE/TERM", "2");

        r = await tokenizeTemplate('$let a="a", b=expr(12), c, d:string;');
        assert.equal(lineInfo(r[1]), "0:4/VE/$let  4:5/VE  5:6/VE/VSVE/VDF/V_RW  6:7/VE/ASSIGNMENT  7:8/VE/STR_D/S_START  8:9/VE/STR_D  9:10/VE/STR_D/S_END  10:11/VE/COMMA  11:12/VE  12:13/VE/VSVE/VDF/V_RW  13:14/VE/ASSIGNMENT  14:18/VE/F_CALL/F_NAME  18:19/VE/BRACE_R  19:21/VE/NUM  21:22/VE/BRACE_R  22:23/VE/COMMA  23:24/VE  24:25/VE/VSVE/VDF/V_RW  25:26/VE/COMMA  26:27/VE  27:28/VE/VSVE/VDF/V_RW  28:29/VE/VSVE/TYPE_AN/TYPE_SEP  29:35/VE/VSVE/TYPE_AN/TYPE_PRIMITIVE  35:36/VE/TERM", "3");

        r = await tokenizeTemplate('!$let foo=bar;');
        assert.equal(lineInfo(r[1]), "0:2/ESC  2:15/", "4");
    });

    it("should support $each js statements", async function () {
        let r: IToken[][];
        r = await tokenizeTemplate('$each(items, (item, index:number, isLast:boolean) => {abc\n<div/>\n});def');
        assert.equal(lineInfo(r[1]), "0:5/$C/$each  5:6/$C/BRACE_R  6:11/$C/V_RW  11:12/$C/COMMA  12:13/$C  13:14/$C/PARAM/P_START  14:18/$C/PARAM/P_VAR  18:19/$C/PARAM/SEP  19:20/$C/PARAM  20:25/$C/PARAM/P_VAR  25:26/$C/PARAM/TYPE_AN/TYPE_SEP  26:32/$C/PARAM/TYPE_AN/TYPE_PRIMITIVE  32:33/$C/PARAM/SEP  33:34/$C/PARAM  34:40/$C/PARAM/P_VAR  40:41/$C/PARAM/TYPE_AN/TYPE_SEP  41:48/$C/PARAM/TYPE_AN/TYPE_PRIMITIVE  48:49/$C/PARAM/P_END  49:50/$C  50:52/$C/ARROW  52:53/$C  53:54/$C/BLOCK/B  54:58/$C/BLOCK", "1.1");
        assert.equal(lineInfo(r[2]), "0:1/$C/BLOCK/TAG/T_START  1:4/$C/BLOCK/TAG/T_NAME  4:5/$C/BLOCK/TAG/T_CLOSE  5:6/$C/BLOCK/TAG/T_END", "1.2");
        assert.equal(lineInfo(r[3]), "0:1/$C/BLOCK/B  1:2/$C/BRACE_R  2:3/$C/TERM  3:7/", "1.3");

        r = await tokenizeTemplate('$each(items, (item) => {\nabc\n});def');
        assert.equal(lineInfo(r[1]), "0:5/$C/$each  5:6/$C/BRACE_R  6:11/$C/V_RW  11:12/$C/COMMA  12:13/$C  13:14/$C/PARAM/P_START  14:18/$C/PARAM/P_VAR  18:19/$C/PARAM/P_END  19:20/$C  20:22/$C/ARROW  22:23/$C  23:24/$C/BLOCK/B", "2.1");
        assert.equal(lineInfo(r[2]), "0:4/$C/BLOCK", "2.2");
        assert.equal(lineInfo(r[3]), "0:1/$C/BLOCK/B  1:2/$C/BRACE_R  2:3/$C/TERM  3:7/", "2.3");

        r = await tokenizeTemplate('!$each(blah...)');
        assert.equal(lineInfo(r[1]), "0:2/ESC  2:16/", "3");
    });

    it("should support $log js statements", async function () {
        let r: IToken[][];
        r = await tokenizeTemplate('$log("hello");abc');
        assert.equal(lineInfo(r[1]), "0:4/$L/$log  4:5/$L/BRACE_R  5:6/$L/STR_D/S_START  6:11/$L/STR_D  11:12/$L/STR_D/S_END  12:13/$L/BRACE_R  13:14/$L/TERM  14:18/", "1");

        r = await tokenizeTemplate('$log(\"a\", someVar);abc');
        assert.equal(lineInfo(r[1]), "0:4/$L/$log  4:5/$L/BRACE_R  5:6/$L/STR_D/S_START  6:7/$L/STR_D  7:8/$L/STR_D/S_END  8:9/$L/COMMA  9:10/$L  10:17/$L/V_RW  17:18/$L/BRACE_R  18:19/$L/TERM  19:23/", "2");

        r = await tokenizeTemplate('!$log');
        assert.equal(lineInfo(r[1]), "0:2/ESC  2:6/", "3");
    });

    it("should support $template js statements", async function () {
        let r: IToken[][];
        r = await tokenizeTemplate('$template foo(arg:string) {abc\nx<div/>y\n}');
        assert.equal(lineInfo(r[1]), "0:9/$T/$template  9:10/$T  10:13/$T/FUN/F_NAME  13:14/$T/PARAM/P_START  14:17/$T/PARAM/P_VAR  17:18/$T/PARAM/TYPE_AN/TYPE_SEP  18:24/$T/PARAM/TYPE_AN/TYPE_PRIMITIVE  24:25/$T/PARAM/P_END  25:26/$T  26:27/$T/BLOCK/B  27:31/$T/BLOCK", "1.1");
        assert.equal(lineInfo(r[2]), "0:1/$T/BLOCK  1:2/$T/BLOCK/TAG/T_START  2:5/$T/BLOCK/TAG/T_NAME  5:6/$T/BLOCK/TAG/T_CLOSE  6:7/$T/BLOCK/TAG/T_END  7:9/$T/BLOCK", "1.2");
        assert.equal(lineInfo(r[3]), "0:1/$T/BLOCK/B", "1.3");

        r = await tokenizeTemplate('$template foo(a,b,c) {\nabc\n}def');
        assert.equal(lineInfo(r[1]), "0:9/$T/$template  9:10/$T  10:13/$T/FUN/F_NAME  13:14/$T/PARAM/P_START  14:15/$T/PARAM/P_VAR  15:16/$T/PARAM/SEP  16:17/$T/PARAM/P_VAR  17:18/$T/PARAM/SEP  18:19/$T/PARAM/P_VAR  19:20/$T/PARAM/P_END  20:21/$T  21:22/$T/BLOCK/B", "2.1");
        assert.equal(lineInfo(r[2]), "0:4/$T/BLOCK", "2.2");
        assert.equal(lineInfo(r[3]), "0:1/$T/BLOCK/B  1:5/", "2.3");

        r = await tokenizeTemplate('!$template foo');
        assert.equal(lineInfo(r[1]), "0:2/ESC  2:15/", "3");
    });

    it("should support nodes and text in $content", async function () {
        let r: IToken[][];
        r = await tokenizeContent('Hello <b class="a"> World </>...');
        assert.equal(lineInfo(r[1]), "0:6/C  6:7/C/TAG/T_START  7:8/C/TAG/T_NAME  8:9/C/TAG/ATT  9:14/C/TAG/ATT/A_NAME  14:15/C/TAG/ATT/EQ  15:16/C/TAG/ATT/STR_D/S_START  16:17/C/TAG/ATT/STR_D  17:18/C/TAG/ATT/STR_D/S_END  18:19/C/TAG/T_END  19:26/C  26:27/C/TAG/T_START  27:28/C/TAG/T_CLOSE  28:29/C/TAG/T_END  29:33/C", "1");

        r = await tokenizeContent('<*cpt @deco={foo.bar}> Hi </>');
        assert.equal(lineInfo(r[1]), "0:1/C/TAG/T_START  1:5/C/TAG/T_NAME  5:6/C/TAG/DECO  6:7/C/TAG/DECO/D_DEF  7:11/C/TAG/DECO/A_NAME  11:12/C/TAG/DECO/EQ  12:13/C/TAG/DECO/REF/{  13:16/C/TAG/DECO/REF/V_RW  16:17/C/TAG/DECO/REF/V_ACC  17:20/C/TAG/DECO/REF/V_RW  20:21/C/TAG/DECO/REF/}  21:22/C/TAG/T_END  22:26/C  26:27/C/TAG/T_START  27:28/C/TAG/T_CLOSE  28:29/C/TAG/T_END", "2");

        r = await tokenizeContent(`\
        <!cdata att=123>
            Special chars: {}<>!s!n$ (ignored)
            $if (foo) {bar}
            <div> Everything here is considered as a string </div>
            // including comments
            <!cdata>
            !</!cdata> // escaped cdata end
        </!cdata>abc`);
        assert.equal(lineInfo(r[1]), "0:8/C  8:9/C/TAG/T_START  9:15/C/TAG/T_NAME  15:16/C/TAG/ATT  16:19/C/TAG/ATT/A_NAME  19:20/C/TAG/ATT/EQ  20:23/C/TAG/ATT/NUM  23:24/C/TAG/CDC/T_END", "3.1");
        assert.equal(lineInfo(r[2]), "0:46/C/TAG/CDC/CDC", "3.2");
        assert.equal(lineInfo(r[3]), "0:27/C/TAG/CDC/CDC", "3.3");
        assert.equal(lineInfo(r[4]), "0:66/C/TAG/CDC/CDC", "3.4");
        assert.equal(lineInfo(r[5]), "0:33/C/TAG/CDC/CDC", "3.5");
        assert.equal(lineInfo(r[6]), "0:20/C/TAG/CDC/CDC", "3.6");
        assert.equal(lineInfo(r[7]), "0:43/C/TAG/CDC/CDC", "3.7");
        assert.equal(lineInfo(r[8]), "0:7/C/TAG/CDC/CDC  7:8/C/TAG/CDC/CDC  8:10/C/TAG/T_START  10:16/C/TAG/T_NAME  16:17/C/TAG/T_END  17:21/C", "3.8");
    });

    it("should support $if, $each and $log in $content", async function () {
        let r: IToken[][];
        r = await tokenizeContent('$if (a.b.c) {abc}');
        assert.equal(lineInfo(r[1]), "0:3/C/$IF/$if  3:4/C/$IF  4:5/C/$IF/BRACE_R  5:6/C/$IF/V_RW  6:7/C/$IF/V_ACC  7:8/C/$IF/V_RW  8:9/C/$IF/V_ACC  9:10/C/$IF/V_RW  10:11/C/$IF/BRACE_R  11:12/C/$IF  12:13/C/$IF/BLOCK/B  13:16/C/$IF/BLOCK  16:17/C/$IF/BLOCK/B", "1");

        r = await tokenizeContent('$log("abc", foo.bar);');
        assert.equal(lineInfo(r[1]), "0:4/C/$L/$log  4:5/C/$L/BRACE_R  5:6/C/$L/STR_D/S_START  6:9/C/$L/STR_D  9:10/C/$L/STR_D/S_END  10:11/C/$L/COMMA  11:12/C/$L  12:15/C/$L/V_RW  15:16/C/$L/V_ACC  16:19/C/$L/V_RW  19:20/C/$L/BRACE_R  20:21/C/$L/TERM", "2");

        r = await tokenizeContent('$each(ctxt.items, (item) => {\nHello <div/>\n});');
        assert.equal(lineInfo(r[1]), "0:5/C/$C/$each  5:6/C/$C/BRACE_R  6:10/C/$C/V_RW  10:11/C/$C/V_ACC  11:16/C/$C/V_RW  16:17/C/$C/COMMA  17:18/C/$C  18:19/C/$C/PARAM/P_START  19:23/C/$C/PARAM/P_VAR  23:24/C/$C/PARAM/P_END  24:25/C/$C  25:27/C/$C/ARROW  27:28/C/$C  28:29/C/$C/BLOCK/B", "3.1");
        assert.equal(lineInfo(r[2]), "0:6/C/$C/BLOCK  6:7/C/$C/BLOCK/TAG/T_START  7:10/C/$C/BLOCK/TAG/T_NAME  10:11/C/$C/BLOCK/TAG/T_CLOSE  11:12/C/$C/BLOCK/TAG/T_END", "3.2");
        assert.equal(lineInfo(r[3]), "0:1/C/$C/BLOCK/B  1:2/C/$C/BRACE_R  2:3/C/$C/TERM", "3.3");
    });

    it("should ignore $for, $exec, $let and $template in $content", async function () {
        let r: IToken[][];
        r = await tokenizeContent('$for (let i=0;10>i;i++)');
        assert.equal(lineInfo(r[1]), "0:24/C", "1");

        r = await tokenizeContent('$exec console.log("abc");');
        assert.equal(lineInfo(r[1]), "0:26/C", "2");

        r = await tokenizeContent('$let a=\"a\", b=expr(12), c, d:string;');
        assert.equal(lineInfo(r[1]), "0:37/C", "3");

        r = await tokenizeContent('$template foo(arg1:string)');
        assert.equal(lineInfo(r[1]), "0:27/C", "4");
    });

    it("should support pre-processors in $content", async function () {
        let r: IToken[][];
        r = await tokenizeContent('<div @@extract="foo/bar#blah"/>');
        assert.equal(lineInfo(r[1]), "0:1/C/TAG/T_START  1:4/C/TAG/T_NAME  4:5/C/TAG/DECO  5:7/C/TAG/DECO/D_DEF  7:14/C/TAG/DECO/A_NAME  14:15/C/TAG/DECO/EQ  15:16/C/TAG/DECO/STR_D/S_START  16:28/C/TAG/DECO/STR_D  28:29/C/TAG/DECO/STR_D/S_END  29:30/C/TAG/T_CLOSE  30:31/C/TAG/T_END", "1");
    });

});

