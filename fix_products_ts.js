const fs = require('fs');
let content = fs.readFileSync('public/ts/products.ts', 'utf8');

// 1. Add globals at the very top
const globals = `
interface Window {
    currentImageBase64: any;
    currentImageUrl: any;
    openModal: any;
    closeModal: any;
    loadProducts: any;
}
`;
if (!content.includes('interface Window')) {
    content = globals + content;
}

// 2. Fix implicitly any parameters
content = content.replace(/function hasProductImage\(product\)/, 'function hasProductImage(product: any)');
content = content.replace(/function getProductBase64ImageSrc\(imageBase64\)/, 'function getProductBase64ImageSrc(imageBase64: any)');
content = content.replace(/function getProductImageSrc\(product\)/, 'function getProductImageSrc(product: any)');
content = content.replace(/function getProductImageMarkup\(product, sizeClass = 'w-12 h-12'\)/, 'function getProductImageMarkup(product: any, sizeClass = \\\'w-12 h-12\\\')');
content = content.replace(/function isLowStock\(product\)/, 'function isLowStock(product: any)');
content = content.replace(/function normalizeFilterText\(value\)/, 'function normalizeFilterText(value: any)');
content = content.replace(/function getProductImageFileName\(source\)/, 'function getProductImageFileName(source: any)');
content = content.replace(/function setProductImageDropzoneActive\(isActive\)/, 'function setProductImageDropzoneActive(isActive: any)');
content = content.replace(/function handleProductImageFile\(file\)/, 'function handleProductImageFile(file: any)');
content = content.replace(/function switchTab\(tabId\)/, 'function switchTab(tabId: any)');
content = content.replace(/const formatCurrency = \(value\)/, 'const formatCurrency = (value: any)');

// 3. Fix (e) parameters and other arrow function params without types
content = content.replace(/\(e\) => \{/g, '(e: any) => {');
content = content.replace(/\(event\) => \{/g, '(event: any) => {');
content = content.replace(/const parseNumber = \(val\)/g, 'const parseNumber = (val: any)');
content = content.replace(/\(product\) => \{/g, '(product: any) => {');
content = content.replace(/\(btn\) => \{/g, '(btn: any) => {');
content = content.replace(/\(cb\) =>/g, '(cb: any) =>');
content = content.replace(/\(cb\) => \{/g, '(cb: any) => {');
content = content.replace(/\(np\) =>/g, '(np: any) =>');
content = content.replace(/\(i\) => \{/g, '(i: any) => {');
content = content.replace(/Object\.keys\(payload\)\.forEach\(key => payload\[key\]/g, 'Object.keys(payload).forEach((key: any) => payload[key]');

// 6. Fix `error` is of type `unknown`
content = content.replace(/} catch \(error\) {/g, '} catch (error: any) {');

// 9. Fix GridSummaryFooter usage
content = content.replace(/new GridSummaryFooter/g, 'new (window as any).GridSummaryFooter');

// 10. Fix showAlert usage
content = content.replace(/UI\.showAlert/g, '(window as any).UI.showAlert');

fs.writeFileSync('public/ts/products.ts', content);
