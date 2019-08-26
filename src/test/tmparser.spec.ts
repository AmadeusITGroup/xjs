import { SCOPES } from '../parser/scopes';
import * as assert from 'assert';
import { parse, TmAstNode } from '../parser/tm-parser';


describe('TextMate parser', () => {
    const rootPrefix = "            ", indent = "    ";

    function serialize(nd: TmAstNode, prefix: string = ''): string {
        let isRoot = (prefix === ''), r: string[] = [];
        if (isRoot) {
            prefix = rootPrefix;
            r.push("");
        }
        let nm = SCOPES[nd.scopeName] || nd.scopeName;
        if (nd.scopeName === undefined) {
            console.log("AA")
        }

        r.push(prefix + nm + " " + nd.startLineIdx + ":" + nd.startPosition + "/" + nd.endLineIdx + ":" + nd.endPosition);
        if (nd.children) {
            for (let c of nd.children) {
                r.push(serialize(c, prefix + indent));
            }
        }

        if (isRoot) {
            r.push(rootPrefix);
        }
        return r.join("\n");
    }

    async function parseAndSerialize(tpl: string, log = false) {
        let nd: TmAstNode;
        nd = await parse(tpl);
        let result = serialize(nd);
        if (log) {
            console.log(result)
        }
        return result;
    }

    it("should parse simple tags", async function () {
        assert.deepEqual(await parseAndSerialize('<div>'), `
            S 0:0/0:5
                TAG 0:0/0:5
                    T_START 0:0/0:1
                    T_NAME 0:1/0:4
                    T_END 0:4/0:5
            ` , "<div>");

        assert.deepEqual(await parseAndSerialize('<div> # Hello # </div>'), `
            S 0:0/0:22
                TAG 0:0/0:5
                    T_START 0:0/0:1
                    T_NAME 0:1/0:4
                    T_END 0:4/0:5
                TXT 0:5/0:15
                    TXT_START 0:6/0:7
                    CONTENT 0:7/0:14
                    TXT_END 0:14/0:15
                TAG 0:15/0:22
                    T_START 0:16/0:17
                    T_CLOSE 0:17/0:18
                    T_NAME 0:18/0:21
                    T_END 0:21/0:22
            ` , "<div> Hello </div>");

        assert.deepEqual(await parseAndSerialize('<!> </>'), `
            S 0:0/0:7
                TAG 0:0/0:3
                    T_START 0:0/0:1
                    T_NAME 0:1/0:2
                    T_END 0:2/0:3
                TAG 0:3/0:7
                    T_START 0:4/0:5
                    T_CLOSE 0:5/0:6
                    T_END 0:6/0:7
            ` , "<!> </>");

        assert.deepEqual(await parseAndSerialize('<a-bcd /* comment */ />'), `
            S 0:0/0:23
                TAG 0:0/0:23
                    T_START 0:0/0:1
                    T_NAME 0:1/0:6
                    CONTENT 0:6/0:7
                    COMMENT 0:7/0:20
                        C_DEF 0:7/0:9
                        CONTENT 0:9/0:18
                        C_DEF 0:18/0:20
                    CONTENT 0:20/0:21
                    T_CLOSE 0:21/0:22
                    T_END 0:22/0:23
            ` , '<a-bcd /* comment */ />');

        assert.deepEqual(await parseAndSerialize('<a-bcd // comment \n/>'), `
            S 0:0/1:2
                TAG 0:0/1:2
                    T_START 0:0/0:1
                    T_NAME 0:1/0:6
                    CONTENT 0:6/0:7
                    COMMENT1 0:7/0:18
                        C_DEF 0:7/0:9
                        CONTENT 0:9/0:18
                    T_CLOSE 1:0/1:1
                    T_END 1:1/1:2
            ` , '<a-bcd /* comment */ />');

        assert.deepEqual(await parseAndSerialize('<@b.tooltip />'), `
            S 0:0/0:14
                TAG 0:0/0:14
                    T_START 0:0/0:1
                    T_NAME 0:1/0:11
                    CONTENT 0:11/0:12
                    T_CLOSE 0:12/0:13
                    T_END 0:13/0:14
            ` , "<@b.tooltip />");
    });

    it("should parse expression tags", async function () {
        assert.deepEqual(await parseAndSerialize('<{expr()}>'), `
            S 0:0/0:10
                TAG 0:0/0:10
                    T_START 0:0/0:1
                    BLOCK 0:1/0:9
                        B_START 0:1/0:2
                        F_CALL 0:2/0:6
                            F_NAME 0:2/0:6
                        BRACE_R 0:6/0:8
                            CONTENT 0:7/0:8
                        B_END 0:8/0:9
                    T_END 0:9/0:10
            ` , '1');

        assert.deepEqual(await parseAndSerialize('<.{expr()}/>'), `
            S 0:0/0:12
                TAG 0:0/0:12
                    T_START 0:0/0:1
                    T_PREFIX 0:1/0:2
                    BLOCK 0:2/0:10
                        B_START 0:2/0:3
                        F_CALL 0:3/0:7
                            F_NAME 0:3/0:7
                        BRACE_R 0:7/0:9
                            CONTENT 0:8/0:9
                        B_END 0:9/0:10
                    T_CLOSE 0:10/0:11
                    T_END 0:11/0:12
            ` , '2');
    });

    it("should parse text nodes", async function () {
        assert.deepEqual(await parseAndSerialize('# Hello World #'), `
            S 0:0/0:15
                TXT 0:0/0:15
                    TXT_START 0:0/0:1
                    CONTENT 0:1/0:14
                    TXT_END 0:14/0:15
            ` , "1");

        // assert.deepEqual(await parseAndSerialize('# \(xxx) #', true), `
        //     S 0:0/0:15
        //         TXT 0:0/0:15
        //             TXT_START 0:0/0:1
        //             CONTENT 0:1/0:14
        //             TXT_END 0:14/0:15
        //     ` , "1");

        assert.deepEqual(await parseAndSerialize('# (@abc=123 #foo)(a=1) Hello #'), `
            S 0:0/0:30
                TXT 0:0/0:30
                    TXT_START 0:0/0:1
                    BLOCK_ATT 0:1/0:17
                        B_START 0:1/0:3
                        DECO 0:3/0:12
                            D_DEF 0:3/0:4
                            A_NAME 0:4/0:7
                            EQ 0:7/0:8
                            NUM 0:8/0:11
                            CONTENT 0:11/0:12
                        LBL 0:12/0:16
                            LBL_DEF 0:12/0:13
                            A_NAME 0:13/0:16
                        B_END 0:16/0:17
                    CONTENT 0:17/0:29
                    TXT_END 0:29/0:30
            ` , "2");

        assert.deepEqual(await parseAndSerialize('# Hello {::123} #'), `
            S 0:0/0:17
                TXT 0:0/0:17
                    TXT_START 0:0/0:1
                    CONTENT 0:1/0:8
                    BLOCK 0:8/0:15
                        B_START 0:8/0:9
                        EXP_MOD 0:9/0:11
                        NUM 0:11/0:14
                        B_END 0:14/0:15
                    CONTENT 0:15/0:16
                    TXT_END 0:16/0:17
            ` , "3");
    });

    it("should parse comments", async function () {
        assert.deepEqual(await parseAndSerialize('<div /* a *//* b */> /* c */'), `
            S 0:0/0:28
                TAG 0:0/0:20
                    T_START 0:0/0:1
                    T_NAME 0:1/0:4
                    CONTENT 0:4/0:5
                    COMMENT 0:5/0:12
                        C_DEF 0:5/0:7
                        CONTENT 0:7/0:10
                        C_DEF 0:10/0:12
                    COMMENT 0:12/0:19
                        C_DEF 0:12/0:14
                        CONTENT 0:14/0:17
                        C_DEF 0:17/0:19
                    T_END 0:19/0:20
                CONTENT 0:20/0:21
                COMMENT 0:21/0:28
                    C_DEF 0:21/0:23
                    CONTENT 0:23/0:26
                    C_DEF 0:26/0:28
            ` , "1");
    });

    it("should parse blocks", async function () {
        assert.deepEqual(await parseAndSerialize('{123}{456}'), `
            S 0:0/0:10
                BLOCK 0:0/0:5
                    B_DEF 0:0/0:1
                    NUM 0:1/0:4
                    B_DEF 0:4/0:5
                BLOCK 0:5/0:10
                    B_DEF 0:5/0:6
                    NUM 0:6/0:9
                    B_DEF 0:9/0:10
            ` , "1");
    });

    it("should parse nodes in nodes on multiple lines", async function () {
        assert.deepEqual(await parseAndSerialize(`
            <div>
                <span> /* content */ </>
            </div>
        `), `
            S 0:0/4:9
                TAG 1:0/1:17
                    T_START 1:12/1:13
                    T_NAME 1:13/1:16
                    T_END 1:16/1:17
                TAG 2:0/2:22
                    T_START 2:16/2:17
                    T_NAME 2:17/2:21
                    T_END 2:21/2:22
                CONTENT 2:22/2:23
                COMMENT 2:23/2:36
                    C_DEF 2:23/2:25
                    CONTENT 2:25/2:34
                    C_DEF 2:34/2:36
                TAG 2:36/2:40
                    T_START 2:37/2:38
                    T_CLOSE 2:38/2:39
                    T_END 2:39/2:40
                TAG 3:0/3:18
                    T_START 3:12/3:13
                    T_CLOSE 3:13/3:14
                    T_NAME 3:14/3:17
                    T_END 3:17/3:18
                CONTENT 4:0/4:9
            ` , "1");

        assert.deepEqual(await parseAndSerialize(`
            <div>
                let x = 123;
            </div>
        `), `
            S 0:0/4:9
                TAG 1:0/1:17
                    T_START 1:12/1:13
                    T_NAME 1:13/1:16
                    T_END 1:16/1:17
                CONTENT 2:0/2:16
                meta.var.expr.ts 2:16/2:27
                    storage.type.ts 2:16/2:19
                    CONTENT 2:19/2:20
                    meta.var-single-variable.expr.ts 2:20/2:22
                        meta.definition.variable.ts 2:20/2:21
                            V_RW 2:20/2:21
                        CONTENT 2:21/2:22
                    ASSIGNMENT 2:22/2:23
                    CONTENT 2:23/2:24
                    NUM 2:24/2:27
                TERM 2:27/2:28
                TAG 3:0/3:18
                    T_START 3:12/3:13
                    T_CLOSE 3:13/3:14
                    T_NAME 3:14/3:17
                    T_END 3:17/3:18
                CONTENT 4:0/4:9
            ` , "2");

        assert.deepEqual(await parseAndSerialize(`
            <div>
                if (foo) {
                    <span> </span>
                }
            </div>
        `), `
            S 0:0/6:9
                TAG 1:0/1:17
                    T_START 1:12/1:13
                    T_NAME 1:13/1:16
                    T_END 1:16/1:17
                CONTENT 2:0/2:16
                keyword.control.conditional.ts 2:16/2:18
                CONTENT 2:18/2:19
                BRACE_R 2:19/2:20
                V_RW 2:20/2:23
                BRACE_R 2:23/2:24
                CONTENT 2:24/2:25
                BLOCK 2:25/4:17
                    B_DEF 2:25/2:26
                    TAG 3:0/3:26
                        T_START 3:20/3:21
                        T_NAME 3:21/3:25
                        T_END 3:25/3:26
                    TAG 3:26/3:34
                        T_START 3:27/3:28
                        T_CLOSE 3:28/3:29
                        T_NAME 3:29/3:33
                        T_END 3:33/3:34
                    CONTENT 4:0/4:16
                    B_DEF 4:16/4:17
                TAG 5:0/5:18
                    T_START 5:12/5:13
                    T_CLOSE 5:13/5:14
                    T_NAME 5:14/5:17
                    T_END 5:17/5:18
                CONTENT 6:0/6:9
            ` , "3");
    });

    it("should parse attributes", async function () {
        assert.deepEqual(await parseAndSerialize('<div foo=123 bar = true baz= "hello">'), `
            S 0:0/0:37
                TAG 0:0/0:37
                    T_START 0:0/0:1
                    T_NAME 0:1/0:4
                    ATT 0:4/0:13
                        A_NAME 0:5/0:8
                        EQ 0:8/0:9
                        NUM 0:9/0:12
                        CONTENT 0:12/0:13
                    ATT 0:13/0:24
                        A_NAME 0:13/0:16
                        CONTENT 0:16/0:17
                        EQ 0:17/0:18
                        CONTENT 0:18/0:19
                        TRUE 0:19/0:23
                        CONTENT 0:23/0:24
                    ATT 0:24/0:36
                        A_NAME 0:24/0:27
                        EQ 0:27/0:28
                        CONTENT 0:28/0:29
                        STR_D 0:29/0:36
                            S_START 0:29/0:30
                            CONTENT 0:30/0:35
                            S_END 0:35/0:36
                    T_END 0:36/0:37
            ` , "1");

        assert.deepEqual(await parseAndSerialize('<div disabled important foo=123>'), `
            S 0:0/0:32
                TAG 0:0/0:32
                    T_START 0:0/0:1
                    T_NAME 0:1/0:4
                    ATT1 0:4/0:14
                        A_NAME 0:5/0:13
                        CONTENT 0:13/0:14
                    ATT1 0:14/0:23
                        A_NAME 0:14/0:23
                    ATT 0:23/0:31
                        A_NAME 0:24/0:27
                        EQ 0:27/0:28
                        NUM 0:28/0:31
                    T_END 0:31/0:32
            ` , "2");

        assert.deepEqual(await parseAndSerialize('<div someFunc={=>abc()}>'), `
            S 0:0/0:24
                TAG 0:0/0:24
                    T_START 0:0/0:1
                    T_NAME 0:1/0:4
                    ATT 0:4/0:23
                        A_NAME 0:5/0:13
                        EQ 0:13/0:14
                        BLOCK 0:14/0:23
                            B_START 0:14/0:15
                            EXP_MOD 0:15/0:17
                            F_CALL 0:17/0:20
                                F_NAME 0:17/0:20
                            BRACE_R 0:20/0:22
                                CONTENT 0:21/0:22
                            B_END 0:22/0:23
                    T_END 0:23/0:24
            ` , "2");
    });

    it("should parse decorators", async function () {
        assert.deepEqual(await parseAndSerialize('<div @foo @bar>'), `
            S 0:0/0:15
                TAG 0:0/0:15
                    T_START 0:0/0:1
                    T_NAME 0:1/0:4
                    DECO1 0:4/0:9
                        D_DEF 0:5/0:6
                        A_NAME 0:6/0:9
                    DECO1 0:9/0:14
                        D_DEF 0:10/0:11
                        A_NAME 0:11/0:14
                    T_END 0:14/0:15
            ` , "1");

        assert.deepEqual(await parseAndSerialize('<div @foo =true @bar= 123>'), `
            S 0:0/0:26
                TAG 0:0/0:26
                    T_START 0:0/0:1
                    T_NAME 0:1/0:4
                    DECO 0:4/0:16
                        D_DEF 0:5/0:6
                        A_NAME 0:6/0:9
                        CONTENT 0:9/0:10
                        EQ 0:10/0:11
                        TRUE 0:11/0:15
                        CONTENT 0:15/0:16
                    DECO 0:16/0:25
                        D_DEF 0:16/0:17
                        A_NAME 0:17/0:20
                        EQ 0:20/0:21
                        CONTENT 0:21/0:22
                        NUM 0:22/0:25
                    T_END 0:25/0:26
            ` , "2");

        assert.deepEqual(await parseAndSerialize('<div @foo={123} @bar={456}>'), `
            S 0:0/0:27
                TAG 0:0/0:27
                    T_START 0:0/0:1
                    T_NAME 0:1/0:4
                    DECO 0:4/0:16
                        D_DEF 0:5/0:6
                        A_NAME 0:6/0:9
                        EQ 0:9/0:10
                        BLOCK 0:10/0:15
                            B_START 0:10/0:11
                            NUM 0:11/0:14
                            B_END 0:14/0:15
                        CONTENT 0:15/0:16
                    DECO 0:16/0:26
                        D_DEF 0:16/0:17
                        A_NAME 0:17/0:20
                        EQ 0:20/0:21
                        BLOCK 0:21/0:26
                            B_START 0:21/0:22
                            NUM 0:22/0:25
                            B_END 0:25/0:26
                    T_END 0:26/0:27
            ` , "3");

        assert.deepEqual(await parseAndSerialize('<div @foo(a=1 b={123} @disabled @bar=2) @bar=4>'), `
            S 0:0/0:47
                TAG 0:0/0:47
                    T_START 0:0/0:1
                    T_NAME 0:1/0:4
                    DECO 0:4/0:39
                        D_DEF 0:5/0:6
                        A_NAME 0:6/0:9
                        D_START 0:9/0:10
                        ATT 0:10/0:14
                            A_NAME 0:10/0:11
                            EQ 0:11/0:12
                            NUM 0:12/0:13
                            CONTENT 0:13/0:14
                        ATT 0:14/0:22
                            A_NAME 0:14/0:15
                            EQ 0:15/0:16
                            BLOCK 0:16/0:21
                                B_START 0:16/0:17
                                NUM 0:17/0:20
                                B_END 0:20/0:21
                            CONTENT 0:21/0:22
                        DECO1 0:22/0:31
                            D_DEF 0:22/0:23
                            A_NAME 0:23/0:31
                        DECO 0:31/0:38
                            D_DEF 0:32/0:33
                            A_NAME 0:33/0:36
                            EQ 0:36/0:37
                            NUM 0:37/0:38
                        D_END 0:38/0:39
                    DECO 0:39/0:46
                        D_DEF 0:40/0:41
                        A_NAME 0:41/0:44
                        EQ 0:44/0:45
                        NUM 0:45/0:46
                    T_END 0:46/0:47
            ` , "4");
    });

    it("should parse properties", async function () {
        assert.deepEqual(await parseAndSerialize('<div [abc]=123 [def]=true>'), `
            S 0:0/0:26
                TAG 0:0/0:26
                    T_START 0:0/0:1
                    T_NAME 0:1/0:4
                    CONTENT 0:4/0:5
                    PR 0:5/0:15
                        PR_START 0:5/0:6
                        A_NAME 0:6/0:9
                        PR_END 0:9/0:10
                        EQ 0:10/0:11
                        NUM 0:11/0:14
                        CONTENT 0:14/0:15
                    PR 0:15/0:25
                        PR_START 0:15/0:16
                        A_NAME 0:16/0:19
                        PR_END 0:19/0:20
                        EQ 0:20/0:21
                        TRUE 0:21/0:25
                    T_END 0:25/0:26
            ` , "1");

        assert.deepEqual(await parseAndSerialize('<div foo [abc]=123>'), `
            S 0:0/0:19
                TAG 0:0/0:19
                    T_START 0:0/0:1
                    T_NAME 0:1/0:4
                    ATT1 0:4/0:8
                        A_NAME 0:5/0:8
                    CONTENT 0:8/0:9
                    PR 0:9/0:18
                        PR_START 0:9/0:10
                        A_NAME 0:10/0:13
                        PR_END 0:13/0:14
                        EQ 0:14/0:15
                        NUM 0:15/0:18
                    T_END 0:18/0:19
            ` , "2");
    });

    it("should parse binding shortcuts", async function () {
        assert.deepEqual(await parseAndSerialize('<div {title}>'), `
            S 0:0/0:13
                TAG 0:0/0:13
                    T_START 0:0/0:1
                    T_NAME 0:1/0:4
                    ATT_EXPR 0:4/0:12
                        B_START 0:5/0:6
                        V_RW 0:6/0:11
                        B_END 0:11/0:12
                    T_END 0:12/0:13
            ` , "1");

        assert.deepEqual(await parseAndSerialize('<div {::title}>'), `
            S 0:0/0:15
                TAG 0:0/0:15
                    T_START 0:0/0:1
                    T_NAME 0:1/0:4
                    ATT_EXPR 0:4/0:14
                        B_START 0:5/0:6
                        EXP_MOD 0:6/0:8
                        V_RW 0:8/0:13
                        B_END 0:13/0:14
                    T_END 0:14/0:15
            ` , "2");

        assert.deepEqual(await parseAndSerialize('<div { title  }>'), `
            S 0:0/0:16
                TAG 0:0/0:16
                    T_START 0:0/0:1
                    T_NAME 0:1/0:4
                    ATT_EXPR 0:4/0:15
                        B_START 0:5/0:6
                        CONTENT 0:6/0:7
                        V_RW 0:7/0:12
                        CONTENT 0:12/0:14
                        B_END 0:14/0:15
                    T_END 0:15/0:16
            ` , "3");

        assert.deepEqual(await parseAndSerialize('<div {[title]}>'), `
            S 0:0/0:15
                TAG 0:0/0:15
                    T_START 0:0/0:1
                    T_NAME 0:1/0:4
                    PR_EXPR 0:4/0:14
                        B_START 0:5/0:6
                        PR_START 0:6/0:7
                        V_RW 0:7/0:12
                        B_END 0:12/0:14
                    T_END 0:14/0:15
            ` , "4");

        assert.deepEqual(await parseAndSerialize('<div {::[title]}>'), `
            S 0:0/0:17
                TAG 0:0/0:17
                    T_START 0:0/0:1
                    T_NAME 0:1/0:4
                    PR_EXPR 0:4/0:16
                        B_START 0:5/0:6
                        EXP_MOD 0:6/0:8
                        PR_START 0:8/0:9
                        V_RW 0:9/0:14
                        B_END 0:14/0:16
                    T_END 0:16/0:17
            ` , "5");

        assert.deepEqual(await parseAndSerialize('<div {[ title   ]}>'), `
            S 0:0/0:19
                TAG 0:0/0:19
                    T_START 0:0/0:1
                    T_NAME 0:1/0:4
                    PR_EXPR 0:4/0:18
                        B_START 0:5/0:6
                        PR_START 0:6/0:7
                        CONTENT 0:7/0:8
                        V_RW 0:8/0:13
                        CONTENT 0:13/0:16
                        B_END 0:16/0:18
                    T_END 0:18/0:19
            ` , "6");
    });

    it("should parse spread attributes", async function () {
        assert.deepEqual(await parseAndSerialize('<div {...expr()}>'), `
            S 0:0/0:17
                TAG 0:0/0:17
                    T_START 0:0/0:1
                    T_NAME 0:1/0:4
                    ATT_SPREAD 0:4/0:16
                        B_START 0:5/0:6
                        EXP_MOD 0:6/0:9
                        F_CALL 0:9/0:13
                            F_NAME 0:9/0:13
                        BRACE_R 0:13/0:15
                            CONTENT 0:14/0:15
                        B_END 0:15/0:16
                    T_END 0:16/0:17
            ` , "1");

        assert.deepEqual(await parseAndSerialize('<div {... expr()   }>'), `
            S 0:0/0:21
                TAG 0:0/0:21
                    T_START 0:0/0:1
                    T_NAME 0:1/0:4
                    ATT_SPREAD 0:4/0:20
                        B_START 0:5/0:6
                        EXP_MOD 0:6/0:9
                        CONTENT 0:9/0:10
                        F_CALL 0:10/0:14
                            F_NAME 0:10/0:14
                        BRACE_R 0:14/0:16
                            CONTENT 0:15/0:16
                        CONTENT 0:16/0:19
                        B_END 0:19/0:20
                    T_END 0:20/0:21
            ` , "2");
        
        assert.deepEqual(await parseAndSerialize('<div {...[ expr() ]}>'), `
            S 0:0/0:21
                TAG 0:0/0:21
                    T_START 0:0/0:1
                    T_NAME 0:1/0:4
                    PR_SPREAD 0:4/0:20
                        B_START 0:5/0:6
                        EXP_MOD 0:6/0:9
                        PR_START 0:9/0:10
                        CONTENT 0:10/0:11
                        F_CALL 0:11/0:15
                            F_NAME 0:11/0:15
                        BRACE_R 0:15/0:17
                            CONTENT 0:16/0:17
                        CONTENT 0:17/0:18
                        B_END 0:18/0:20
                    T_END 0:20/0:21
            ` , "3");
    });

    it("should parse labels", async function () {
        assert.deepEqual(await parseAndSerialize('<div #foo #bar ##baz>'), `
            S 0:0/0:21
                TAG 0:0/0:21
                    T_START 0:0/0:1
                    T_NAME 0:1/0:4
                    LBL 0:4/0:10
                        LBL_DEF 0:5/0:6
                        A_NAME 0:6/0:9
                        CONTENT 0:9/0:10
                    LBL 0:10/0:15
                        LBL_DEF 0:10/0:11
                        A_NAME 0:11/0:14
                        CONTENT 0:14/0:15
                    LBL 0:15/0:20
                        LBL_DEF 0:15/0:17
                        A_NAME 0:17/0:20
                    T_END 0:20/0:21
            ` , "1");

        assert.deepEqual(await parseAndSerialize('<div #foo [bar] = {123}>'), `
            S 0:0/0:24
                TAG 0:0/0:24
                    T_START 0:0/0:1
                    T_NAME 0:1/0:4
                    LBL 0:4/0:9
                        LBL_DEF 0:5/0:6
                        A_NAME 0:6/0:9
                    CONTENT 0:9/0:10
                    PR 0:10/0:23
                        PR_START 0:10/0:11
                        A_NAME 0:11/0:14
                        PR_END 0:14/0:15
                        CONTENT 0:15/0:16
                        EQ 0:16/0:17
                        CONTENT 0:17/0:18
                        BLOCK 0:18/0:23
                            B_START 0:18/0:19
                            NUM 0:19/0:22
                            B_END 0:22/0:23
                    T_END 0:23/0:24
            ` , "2");
    });

    it("should parse the template function", async function () {
        assert.deepEqual(await parseAndSerialize(`() => {
            <div/>
        }`), `
            S 0:0/2:9
                ARROW_FUNCTION 0:0/2:9
                    PARAM 0:0/0:2
                        P_START 0:0/0:1
                        P_END 0:1/0:2
                    CONTENT 0:2/0:3
                    ARROW 0:3/0:5
                    CONTENT 0:5/0:6
                    BLOCK 0:6/2:9
                        B_DEF 0:6/0:7
                        TAG 1:0/1:18
                            T_START 1:12/1:13
                            T_NAME 1:13/1:16
                            T_CLOSE 1:16/1:17
                            T_END 1:17/1:18
                        CONTENT 2:0/2:8
                        B_DEF 2:8/2:9
            ` , "1");

        assert.deepEqual(await parseAndSerialize(`(a:string, b:number) => {
            # hello #
        }`), `
            S 0:0/2:9
                ARROW_FUNCTION 0:0/2:9
                    PARAM 0:0/0:20
                        P_START 0:0/0:1
                        P_VAR 0:1/0:2
                        TYPE_AN 0:2/0:9
                            TYPE_SEP 0:2/0:3
                            TYPE_PRIMITIVE 0:3/0:9
                        SEP 0:9/0:10
                        CONTENT 0:10/0:11
                        P_VAR 0:11/0:12
                        TYPE_AN 0:12/0:19
                            TYPE_SEP 0:12/0:13
                            TYPE_PRIMITIVE 0:13/0:19
                        P_END 0:19/0:20
                    CONTENT 0:20/0:21
                    ARROW 0:21/0:23
                    CONTENT 0:23/0:24
                    BLOCK 0:24/2:9
                        B_DEF 0:24/0:25
                        TXT 1:0/1:21
                            TXT_START 1:12/1:13
                            CONTENT 1:13/1:20
                            TXT_END 1:20/1:21
                        CONTENT 2:0/2:8
                        B_DEF 2:8/2:9
            ` , "2");

        assert.deepEqual(await parseAndSerialize(`($: MyParamClass) => {
            # hello #
        }`), `
            S 0:0/2:9
                ARROW_FUNCTION 0:0/2:9
                    PARAM 0:0/0:17
                        P_START 0:0/0:1
                        P_VAR 0:1/0:2
                        TYPE_AN 0:2/0:16
                            TYPE_SEP 0:2/0:3
                            CONTENT 0:3/0:4
                            TYPE_ENTITY 0:4/0:16
                        P_END 0:16/0:17
                    CONTENT 0:17/0:18
                    ARROW 0:18/0:20
                    CONTENT 0:20/0:21
                    BLOCK 0:21/2:9
                        B_DEF 0:21/0:22
                        TXT 1:0/1:21
                            TXT_START 1:12/1:13
                            CONTENT 1:13/1:20
                            TXT_END 1:20/1:21
                        CONTENT 2:0/2:8
                        B_DEF 2:8/2:9
            ` , "3");

        assert.deepEqual(await parseAndSerialize(`a => {
            # {a} #
        }`), `
            S 0:0/2:9
                ARROW_FUNCTION 0:0/2:9
                    P_VAR 0:0/0:1
                    CONTENT 0:1/0:2
                    ARROW 0:2/0:4
                    CONTENT 0:4/0:5
                    BLOCK 0:5/2:9
                        B_DEF 0:5/0:6
                        TXT 1:0/1:19
                            TXT_START 1:12/1:13
                            CONTENT 1:13/1:14
                            BLOCK 1:14/1:17
                                B_START 1:14/1:15
                                V_RW 1:15/1:16
                                B_END 1:16/1:17
                            CONTENT 1:17/1:18
                            TXT_END 1:18/1:19
                        CONTENT 2:0/2:8
                        B_DEF 2:8/2:9
            ` , "4");
    });

    it("should support module prefixes in argument classes", async function () {
        assert.deepEqual(await parseAndSerialize(`(foo: x.y.FooClass) => {
            # Hello #
        }`), `
            S 0:0/2:9
                ARROW_FUNCTION 0:0/2:9
                    PARAM 0:0/0:19
                        P_START 0:0/0:1
                        P_VAR 0:1/0:4
                        TYPE_AN 0:4/0:18
                            TYPE_SEP 0:4/0:5
                            CONTENT 0:5/0:6
                            MOD 0:6/0:7
                            V_ACC 0:7/0:8
                            MOD 0:8/0:9
                            V_ACC 0:9/0:10
                            TYPE_ENTITY 0:10/0:18
                        P_END 0:18/0:19
                    CONTENT 0:19/0:20
                    ARROW 0:20/0:22
                    CONTENT 0:22/0:23
                    BLOCK 0:23/2:9
                        B_DEF 0:23/0:24
                        TXT 1:0/1:21
                            TXT_START 1:12/1:13
                            CONTENT 1:13/1:20
                            TXT_END 1:20/1:21
                        CONTENT 2:0/2:8
                        B_DEF 2:8/2:9
            ` , "1");
    });

});
