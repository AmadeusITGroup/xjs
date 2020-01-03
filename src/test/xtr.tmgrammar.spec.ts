import * as assert from 'assert';
import { tokenize } from '../xjs/tm-parser';
import { IToken } from 'vscode-textmate';

describe('XTR TextMate grammar', () => {

    const XTR_SCOPES = {
        "cdata.content.xtr": "CDATA",
        "comment.block.ts": "CB",
        "comment.line.double-slash.ts": "CLD",
        "constant.character.escape.ts": "ESC",
        "constant.language.boolean.true.ts": "TRUE",
        "constant.numeric.decimal.ts": "DEC",
        "entity.name.tag.js.xjs": "ETAG",
        "entity.other.attribute.assignment": "ATA",
        "entity.other.attribute-name.js.xjs": "ATN",
        "entity.other.attribute.decorator.assignment": "DCA",
        "entity.other.attribute.decorator.js.xjs": "DECO",
        "entity.other.attribute.orphan": "ATO",
        "entity.other.attribute.reference.js.xtr": "ARF",
        "keyword.operator.assignment.js.xjs": "=",
        "keyword.operator.assignment.ts": "=",
        "meta.definition.variable.ts": "MDV",
        "meta.tag.js.xjs": "TAG",
        "meta.var.expr.ts": "E",
        "punctuation.definition.comment.ts": "PC",
        "punctuation.definition.string.begin.ts": "SB",
        "punctuation.definition.string.end.ts": "SE",
        "punctuation.definition.tag.begin.js.xjs": "PTB",
        "punctuation.definition.tag.close.js.xjs": "PTC",
        "punctuation.definition.tag.end.js.xjs": "PTE",
        "punctuation.section.embedded.begin.js.xjs": "SB",
        "punctuation.section.embedded.decorator.js.xjs": "SD",
        "punctuation.section.embedded.end.js.xjs": "SE",
        "punctuation.section.embedded.property.begin.js.xjs": "SPB",
        "punctuation.section.embedded.property.end.js.xjs": "SPE",
        "punctuation.section.embedded.begin.js.xtr": "SB",
        "punctuation.section.embedded.end.js.xtr": "SE",
        "source.ts": "STS",
        "string.quoted.double.ts": "SQD",
        "tag.attribute.assignment": "ATA",
        "tag.attribute.decorator.assignment": "DCA",
        "tag.attribute": "ATO",
        "tag.attribute.property.assignment": "PRA",
        "variable.other.constant.ts": "VOC",
        "xtr.template.ts": "XT"
    }

    function lineInfo(tokens: IToken[]) {
        let r: string[] = [], len = tokens.length, t: IToken, scope: string[], tmp: string;
        for (let i = 0; len > i; i++) {
            t = tokens[i];
            scope = [];
            for (let j = 0; t.scopes.length > j; j++) {
                scope.push(XTR_SCOPES[t.scopes[j]] || t.scopes[j]);
            }
            r.push(`${t.startIndex}:${t.endIndex}/${scope.join("/")}`);
        }
        return r.join("  ").replace(/STS\/E\/XT/g, "S");
    }

    async function processXtr(src: string): Promise<any[][]> {
        return await tokenize('const foo = xtr`\n' + src + '\n`;');
    }

    it("should support text and comments", async function () {
        let r: IToken[][];
        r = await processXtr('Hello World');
        assert.equal(lineInfo(r[1]), "0:12/S", "1");

        r = await processXtr('Hello\nWorld');
        assert.equal(lineInfo(r[1]), "0:6/S", "2");

        r = await processXtr('Hello //World');
        assert.equal(lineInfo(r[1]), "0:6/S  6:8/S/CLD/PC  8:13/S/CLD", "3");

        r = await processXtr('Hello //Brave New\nWorld');
        assert.equal(lineInfo(r[1]), "0:6/S  6:8/S/CLD/PC  8:17/S/CLD", "4");
        assert.equal(lineInfo(r[2]), "0:6/S", "5");

        r = await processXtr('Hello /*Brave\nNew*/ World');
        assert.equal(lineInfo(r[1]), "0:6/S  6:8/S/CB/PC  8:14/S/CB", "6");
        assert.equal(lineInfo(r[2]), "0:3/S/CB  3:5/S/CB/PC  5:12/S", "7");
    });

    it("should support escaped chars", async function () {
        let r: IToken[][];
        r = await processXtr('Hello\\n+\\s+\\<+\\>+\\\\!');
        assert.equal(lineInfo(r[1]), "0:5/S  5:7/S/ESC  7:8/S  8:10/S/ESC  10:11/S  11:13/S/ESC  13:14/S  14:16/S/ESC  16:17/S  17:19/S/ESC  19:21/S", "1");
    });

    it("should support elements", async function () {
        let r: IToken[][];
        r = await processXtr('<div/>');
        assert.equal(lineInfo(r[1]), "0:1/S/TAG/PTB  1:4/S/TAG/ETAG  4:5/S/TAG/PTC  5:6/S/TAG/PTE", "1");

        r = await processXtr('<div></div>');
        assert.equal(lineInfo(r[1]), "0:1/S/TAG/PTB  1:4/S/TAG/ETAG  4:5/S/TAG/PTE  5:6/S/TAG/PTB  6:7/S/TAG/PTC  7:10/S/TAG/ETAG  10:11/S/TAG/PTE", "2");

        r = await processXtr('<!></>');
        assert.equal(lineInfo(r[1]), "0:1/S/TAG/PTB  1:2/S/TAG/ETAG  2:3/S/TAG/PTE  3:4/S/TAG/PTB  4:5/S/TAG/PTC  5:6/S/TAG/PTE", "3");

        r = await processXtr('<*cpt> Hello </>');
        assert.equal(lineInfo(r[1]), "0:1/S/TAG/PTB  1:5/S/TAG/ETAG  5:6/S/TAG/PTE  6:13/S  13:14/S/TAG/PTB  14:15/S/TAG/PTC  15:16/S/TAG/PTE", "4");
    });

    it("should support attributes", async function () {
        let r: IToken[][];
        r = await processXtr('<div foo="bar"/>');
        assert.equal(lineInfo(r[1]), "0:1/S/TAG/PTB  1:4/S/TAG/ETAG  4:5/S/TAG/ATA  5:8/S/TAG/ATA/ATN  8:9/S/TAG/ATA/=  9:10/S/TAG/ATA/SQD/SB  10:13/S/TAG/ATA/SQD  13:14/S/TAG/ATA/SQD/SE  14:15/S/TAG/PTC  15:16/S/TAG/PTE", "1");

        r = await processXtr('<div foo=123/>');
        assert.equal(lineInfo(r[1]), "0:1/S/TAG/PTB  1:4/S/TAG/ETAG  4:5/S/TAG/ATA  5:8/S/TAG/ATA/ATN  8:9/S/TAG/ATA/=  9:12/S/TAG/ATA/DEC  12:13/S/TAG/PTC  13:14/S/TAG/PTE", "2");

        r = await processXtr('<div foo=true />');
        assert.equal(lineInfo(r[1]), "0:1/S/TAG/PTB  1:4/S/TAG/ETAG  4:5/S/TAG/ATA  5:8/S/TAG/ATA/ATN  8:9/S/TAG/ATA/=  9:13/S/TAG/ATA/TRUE  13:14/S/TAG/ATA  14:15/S/TAG/PTC  15:16/S/TAG/PTE", "3");

        r = await processXtr('<div abc={c.d}>');
        assert.equal(lineInfo(r[1]), "0:1/S/TAG/PTB  1:4/S/TAG/ETAG  4:5/S/TAG/ATA  5:8/S/TAG/ATA/ATN  8:9/S/TAG/ATA/=  9:10/S/TAG/ATA/ARF/SB  10:13/S/TAG/ATA/ARF  13:14/S/TAG/ATA/ARF/SE  14:15/S/TAG/PTE", "4");

        r = await processXtr('<div foo bar>');
        assert.equal(lineInfo(r[1]), "0:1/S/TAG/PTB  1:4/S/TAG/ETAG  4:5/S/TAG/ATO  5:8/S/TAG/ATO/ATN  8:9/S/TAG/ATO  9:12/S/TAG/ATO/ATN  12:13/S/TAG/PTE", "5");
    });

    it("should support properties", async function () {
        let r: IToken[][];
        r = await processXtr('<div [foo]="bar"/>');
        assert.equal(lineInfo(r[1]), "0:1/S/TAG/PTB  1:4/S/TAG/ETAG  4:5/S/TAG  5:6/S/TAG/PRA/SPB  6:9/S/TAG/PRA/ATN  9:10/S/TAG/PRA/SPE  10:11/S/TAG/PRA/=  11:12/S/TAG/PRA/SQD/SB  12:15/S/TAG/PRA/SQD  15:16/S/TAG/PRA/SQD/SE  16:17/S/TAG/PTC  17:18/S/TAG/PTE", "1");

        r = await processXtr('<div [foo]=123/>');
        assert.equal(lineInfo(r[1]), "0:1/S/TAG/PTB  1:4/S/TAG/ETAG  4:5/S/TAG  5:6/S/TAG/PRA/SPB  6:9/S/TAG/PRA/ATN  9:10/S/TAG/PRA/SPE  10:11/S/TAG/PRA/=  11:14/S/TAG/PRA/DEC  14:15/S/TAG/PTC  15:16/S/TAG/PTE", "2");

        r = await processXtr('<div [foo]=true />');
        assert.equal(lineInfo(r[1]), "0:1/S/TAG/PTB  1:4/S/TAG/ETAG  4:5/S/TAG  5:6/S/TAG/PRA/SPB  6:9/S/TAG/PRA/ATN  9:10/S/TAG/PRA/SPE  10:11/S/TAG/PRA/=  11:15/S/TAG/PRA/TRUE  15:16/S/TAG/PRA  16:17/S/TAG/PTC  17:18/S/TAG/PTE", "3");

        r = await processXtr('<div [abc]={c.d}>');
        assert.equal(lineInfo(r[1]), "0:1/S/TAG/PTB  1:4/S/TAG/ETAG  4:5/S/TAG  5:6/S/TAG/PRA/SPB  6:9/S/TAG/PRA/ATN  9:10/S/TAG/PRA/SPE  10:11/S/TAG/PRA/=  11:12/S/TAG/PRA/ARF/SB  12:15/S/TAG/PRA/ARF  15:16/S/TAG/PRA/ARF/SE  16:17/S/TAG/PTE", "4");
    });

    it("should support decorators", async function () {
        let r: IToken[][];
        r = await processXtr('<div @foo @bar/>');
        assert.equal(lineInfo(r[1]), "0:1/S/TAG/PTB  1:4/S/TAG/ETAG  4:5/S/TAG/DECO  5:6/S/TAG/DECO/SD  6:9/S/TAG/DECO/ATN  9:10/S/TAG/DECO  10:11/S/TAG/DECO/SD  11:14/S/TAG/DECO/ATN  14:15/S/TAG/PTC  15:16/S/TAG/PTE", "1");

        r = await processXtr('<div @foo=123/>');
        assert.equal(lineInfo(r[1]), "0:1/S/TAG/PTB  1:4/S/TAG/ETAG  4:5/S/TAG/DCA  5:6/S/TAG/DCA/SD  6:9/S/TAG/DCA/ATN  9:10/S/TAG/DCA/=  10:13/S/TAG/DCA/DEC  13:14/S/TAG/PTC  14:15/S/TAG/PTE", "2");

        r = await processXtr('<div @foo={a.b.c}/>');
        assert.equal(lineInfo(r[1]), "0:1/S/TAG/PTB  1:4/S/TAG/ETAG  4:5/S/TAG/DCA  5:6/S/TAG/DCA/SD  6:9/S/TAG/DCA/ATN  9:10/S/TAG/DCA/=  10:11/S/TAG/DCA/ARF/SB  11:16/S/TAG/DCA/ARF  16:17/S/TAG/DCA/ARF/SE  17:18/S/TAG/PTC  18:19/S/TAG/PTE", "3");
    });

    it("should support pre-processors", async function () {
        let r: IToken[][];
        r = await processXtr('<div @@foo @@bar/>');
        assert.equal(lineInfo(r[1]), "0:1/S/TAG/PTB  1:4/S/TAG/ETAG  4:5/S/TAG/DECO  5:7/S/TAG/DECO/SD  7:10/S/TAG/DECO/ATN  10:11/S/TAG/DECO  11:13/S/TAG/DECO/SD  13:16/S/TAG/DECO/ATN  16:17/S/TAG/PTC  17:18/S/TAG/PTE", "1");

        r = await processXtr('<div @@foo=123/>');
        assert.equal(lineInfo(r[1]), "0:1/S/TAG/PTB  1:4/S/TAG/ETAG  4:5/S/TAG/DCA  5:7/S/TAG/DCA/SD  7:10/S/TAG/DCA/ATN  10:11/S/TAG/DCA/=  11:14/S/TAG/DCA/DEC  14:15/S/TAG/PTC  15:16/S/TAG/PTE", "2");

        r = await processXtr('<div @@foo={a.b.c}/>');
        assert.equal(lineInfo(r[1]), "0:1/S/TAG/PTB  1:4/S/TAG/ETAG  4:5/S/TAG/DCA  5:7/S/TAG/DCA/SD  7:10/S/TAG/DCA/ATN  10:11/S/TAG/DCA/=  11:12/S/TAG/DCA/ARF/SB  12:17/S/TAG/DCA/ARF  17:18/S/TAG/DCA/ARF/SE  18:19/S/TAG/PTC  19:20/S/TAG/PTE", "3");
    });

    it("should support cdata", async function () {
        let r: IToken[][];
        r = await processXtr('<!cdata></!cdata>');
        assert.equal(lineInfo(r[1]), "0:1/S/TAG/PTB  1:7/S/TAG/ETAG  7:8/S/TAG/CDATA/PTE  8:10/S/TAG/PTB  10:16/S/TAG/ETAG  16:17/S/TAG/PTE", "1");

        r = await processXtr('<!cdata> ABCD EFG /* comment */ \\</!cdata> xyz </!cdata>');
        assert.equal(lineInfo(r[1]), "0:1/S/TAG/PTB  1:7/S/TAG/ETAG  7:8/S/TAG/CDATA/PTE  8:46/S/TAG/CDATA/CDATA  46:47/S/TAG/CDATA/CDATA  47:49/S/TAG/PTB  49:55/S/TAG/ETAG  55:56/S/TAG/PTE", "2");

        r = await processXtr('<!cdata foo="bar" > ABC </!cdata>');
        assert.equal(lineInfo(r[1]), "0:1/S/TAG/PTB  1:7/S/TAG/ETAG  7:8/S/TAG/ATA  8:11/S/TAG/ATA/ATN  11:12/S/TAG/ATA/=  12:13/S/TAG/ATA/SQD/SB  13:16/S/TAG/ATA/SQD  16:17/S/TAG/ATA/SQD/SE  17:18/S/TAG/ATA  18:19/S/TAG/CDATA/PTE  19:23/S/TAG/CDATA/CDATA  23:24/S/TAG/CDATA/CDATA  24:26/S/TAG/PTB  26:32/S/TAG/ETAG  32:33/S/TAG/PTE", "3");
    });
});