
import * as fs from 'fs';
import * as vsTM from 'vscode-textmate';

const XJS_TM_GRAMMAR = 'syntaxes/xjs.tmLanguage.json';

const REGISTRY = new vsTM.Registry({
    loadGrammar: function (initialScopeName) {
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

let grammar: vsTM.IGrammar | null | undefined;


/**
 * Return the list of tokens parsed by the Text Mate grammar
 * @param src the template string
 */
export async function tmTokens(src: string): Promise<vsTM.IToken[][]> {
    if (!grammar) {
        grammar = await REGISTRY.loadGrammar("source.ts");
    }

    let ruleStack: vsTM.StackElement | undefined, lines = src.split("\n"), result: vsTM.IToken[][] = [];
    for (var i = 0; i < lines.length; i++) {
        var r = grammar!.tokenizeLine(lines[i], <any>ruleStack);
        result.push(r.tokens);
        ruleStack = r.ruleStack;
    }
    return result;
}

export async function tmTree() {
    
}