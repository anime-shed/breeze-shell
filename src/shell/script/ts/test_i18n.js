
// Simple verification script for i18n interpolation logic

const interpolate = (str, params) => {
    return str.replace(/{(\w+)}/g, (match, key) => {
        return params.hasOwnProperty(key) ? params[key] : match;
    });
};

const tests = [
    {
        name: "Basic interpolation",
        template: "Hello {name}!",
        params: { name: "World" },
        expected: "Hello World!"
    },
    {
        name: "Multiple params",
        template: "{greeting} {name}!",
        params: { greeting: "Hi", name: "User" },
        expected: "Hi User!"
    },
    {
        name: "Missing param",
        template: "Hello {name}!",
        params: {},
        expected: "Hello {name}!"
    },
    {
        name: "Unused param",
        template: "Hello {name}!",
        params: { name: "World", date: "Today" },
        expected: "Hello World!"
    },
    {
        name: "No placeholder",
        template: "Hello World",
        params: { name: "User" },
        expected: "Hello World"
    }
];

let failed = 0;
console.log("Running i18n interpolation tests...");

tests.forEach(test => {
    const result = interpolate(test.template, test.params);
    if (result === test.expected) {
        console.log(`[PASS] ${test.name}`);
    } else {
        console.error(`[FAIL] ${test.name}`);
        console.error(`  Expected: "${test.expected}"`);
        console.error(`  Actual:   "${result}"`);
        failed++;
    }
});

if (failed === 0) {
    console.log("\nAll tests passed!");
    process.exit(0);
} else {
    console.error(`\n${failed} tests failed.`);
    process.exit(1);
}
