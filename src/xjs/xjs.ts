
// tagged template function for xjs $content strings
export function $content(strings: TemplateStringsArray, ...keys: any[]) {
    if (keys.length === 0) {
        return strings[0];
    }
    let buf: string[] = [], len1 = strings.length, len2 = keys.length;
    for (let i = 0; len1 > i; i++) {
        buf.push(strings[i]);
        if (i < len2) {
            buf.push(keys[i]);
        }
    }
    return buf.join("");
}

export function $template(strings: TemplateStringsArray) {
    return strings[0]; // will never be called
}