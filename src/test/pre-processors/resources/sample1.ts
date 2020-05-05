
// Sample ts file for the @@extract tests

// @@extract: sectionA

function foo() {
    // comment with <span>
    return "bar";
}

// @@extract: sectionB
// Hello World

// @@extract: sectionF
const xyz = ` Some stuff \`here\` `;

// @@extract: sectionC
class TheClass {
    method() {

        return 123;
    }
}

// @@extract: a
const a = "b";
// @@extract: b
if (a) {
// @@extract: c
    foo();
}
// @@extract: d
// last
// @@extract: e
// end