
import * as fs from 'fs';
import * as vsTM from 'vscode-textmate';
import { SCOPES, ATT, A_NAME, ATT1, COMMENT, C_DEF, DECO, DECO1, D_DEF, B_DEF, BLOCK, PR, PR_START, LBL, LBL_DEF } from './scopes';

const XJS_TM_GRAMMAR = 'syntaxes/xjs.tmLanguage.json';

const XJS_REGISTRY = new vsTM.Registry({
    loadGrammar: function () {
        return new Promise((c, e) => {
            fs.readFile(XJS_TM_GRAMMAR, (error, content) => {
                if (error) {
                    e(error);
                } else {
                    var rawGrammar = vsTM.parseRawGrammar(content.toString(), XJS_TM_GRAMMAR);
                    c(rawGrammar);
                }
            });
        });
    }
});

let xjsGrammar: vsTM.IGrammar | null | undefined;

export async function tokenize(src: string): Promise<vsTM.IToken[][]> {
    if (!xjsGrammar) {
        xjsGrammar = await XJS_REGISTRY.loadGrammar("source.ts");
    }

    let ruleStack: vsTM.StackElement | undefined, lines = src.split("\n"), result: vsTM.IToken[][] = [];
    for (var i = 0; i < lines.length; i++) {
        var r = xjsGrammar!.tokenizeLine(lines[i], <any>ruleStack);
        result.push(r.tokens);
        ruleStack = r.ruleStack;
    }
    return result;
}

export class TmAstNode {
    startPosition: number = -1;
    endPosition: number = -1;
    endLineIdx: number = -1;
    children: TmAstNode[];

    constructor(public scopeName: string, public token: vsTM.IToken, public startLineIdx: number) {
        this.startPosition = token.startIndex;
        this.endLineIdx = startLineIdx;    // may be temporary - cf. groupChildNodes
        this.endPosition = token.endIndex; // may be temporary - cf. groupChildNodes
    }

    countChildren(childScope) {
        let ch = this.children, count = 0;
        if (!ch) return 0;
        for (let i = 0, ln = ch.length; ln > i; i++) {
            if (ch[i].scopeName === childScope) count += 1;
        }
        return count;
    }
}

export async function parse(src: string): Promise<TmAstNode> {
    let tokens = await tokenize(src);
    return groupChildNodes(0, 0, 0, tokens);
}

function groupChildNodes(lineIdx: number, tokenIdx: number, scopeIdx: number, tokens: vsTM.IToken[][]): TmAstNode {
    let lineTokens = tokens[lineIdx], token = lineTokens[tokenIdx];
    let scopeName = token.scopes[scopeIdx], nodes: TmAstNode[] = [];
    let nd = new TmAstNode(scopeName, token, lineIdx), ndNExt: TmAstNode | undefined = undefined;
    nd.children = nodes;

    token["$processed"] = true;
    if (token.scopes.length > scopeIdx + 1) {
        if (!isValidChild(tokens[lineIdx][tokenIdx].scopes[scopeIdx + 1])) {
            return finalize();
        }
        ndNExt = groupChildNodes(lineIdx, tokenIdx, scopeIdx + 1, tokens);
        nodes.push(ndNExt);
        if (isEndNode(ndNExt)) {
            return finalize();
        }
    }

    function nextSibling(): vsTM.IToken | null {
        let lineTokens = tokens[lineIdx];
        if (tokenIdx + 1 < lineTokens.length) {
            tokenIdx++;
            return lineTokens[tokenIdx];
        } else if (lineIdx + 1 < tokens.length) {
            lineIdx++;
            tokenIdx = 0;
            return tokens[lineIdx][tokenIdx];
        } else {
            return null;
        }
    }

    let nextToken = nextSibling();
    while (nextToken) {
        if (nextToken.scopes.length > scopeIdx && nextToken.scopes[scopeIdx] === scopeName) {
            // next token has the same current scope (but could be a different instance!)
            if (!nextToken["$processed"]) {
                let tk = tokens[lineIdx][tokenIdx];
                if (!isValidChild(tk.scopes[scopeIdx + 1])) {
                    return finalize();
                }
                if (scopeIdx + 1 < tk.scopes.length) {
                    // there is a sub-scope
                    ndNExt = groupChildNodes(lineIdx, tokenIdx, scopeIdx + 1, tokens);
                    nodes.push(ndNExt);
                    if (isEndNode(ndNExt)) return finalize();
                } else {
                    if (!acceptsContent()) return finalize();
                    // this node corresponds to content
                    let c = new TmAstNode(scopeName, tk, lineIdx);
                    c.scopeName = "content";
                    tk["$processed"] = true;
                    nodes.push(c);
                }
            }
            nextToken = nextSibling();
        } else {
            nextToken = null;
        }
    }

    return finalize();

    function isEndNode(n: TmAstNode): boolean {
        let scope = nd.scopeName;
        if (scope === COMMENT) {
            if (n.scopeName === C_DEF) {
                return nd.countChildren(C_DEF) === 2;
            }
        } else {
            if (scope !== PR) {
                let nm = SCOPES[n.scopeName];
                return (nm !== undefined && nm.match(/END$/) !== null);
            }
        }
        return false;
    }

    function isValidChild(subScopeName: string) {
        let scope = nd.scopeName;
        if (scope === ATT || scope === ATT1) {
            if (subScopeName === A_NAME) return nd.countChildren(A_NAME) === 0;
        }
        if (scope === C_DEF) return false;
        if (scope === DECO || scope === DECO1) {
            if (subScopeName === D_DEF) return nd.countChildren(D_DEF) === 0;
        }
        if (scope === BLOCK) {
            if (subScopeName === B_DEF) return nd.countChildren(B_DEF) < 2;
        }
        if (scope === PR) {
            if (subScopeName === PR_START) return nd.countChildren(PR_START) === 0;
        }
        if (scope === LBL) {
            if (subScopeName === LBL_DEF) return nd.countChildren(LBL_DEF) === 0;
        }
        return true;
    }

    function acceptsContent() {
        let scope = nd.scopeName;
        if (scope === DECO1) return false;
        if (scope === B_DEF) return false;
        return true;
    }

    function finalize() {
        if (nodes.length) {
            let list = nodes, last: TmAstNode;
            do {
                last = list[list.length - 1];
                list = last.children;
            } while (list && list.length)

            // override endLineIdx and endPosition
            nd.endLineIdx = last.endLineIdx;
            nd.endPosition = last.endPosition;
        }
        return nd;
    }
}

