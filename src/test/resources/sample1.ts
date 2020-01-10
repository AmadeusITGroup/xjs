
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
