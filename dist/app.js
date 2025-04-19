"use strict";
var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.screenshotDir = void 0;
const express_1 = __importDefault(require("express"));
const dotenv_1 = __importDefault(require("dotenv"));
const express_async_handler_1 = __importDefault(require("express-async-handler"));
const htmlRenderService_1 = require("./services/htmlRenderService");
const path_1 = __importDefault(require("path"));
const fs_1 = __importDefault(require("fs"));
// Load environment variables
dotenv_1.default.config();
const app = (0, express_1.default)();
const port = process.env.PORT || 3000;
app.get('/', (req, res) => {
    res.send('Hello, TypeScript Express!');
});
var ProcessStatus;
(function (ProcessStatus) {
    ProcessStatus["PROCESSING"] = "processing";
    ProcessStatus["IDLE"] = "idle";
})(ProcessStatus || (ProcessStatus = {}));
exports.screenshotDir = path_1.default.join(__dirname, '../screenshots');
let status = ProcessStatus.IDLE;
app.get('/api/render-url', (0, express_async_handler_1.default)((req, res) => __awaiter(void 0, void 0, void 0, function* () {
    // 1. Handle input.
    // 1.1 Access the url from the request parameter
    const url = req.query.url;
    if (!url) {
        res.send({
            success: false,
            error: 'URL is required',
        });
        return;
    }
    // 1.1.1 Check the url is valid
    if (!url.startsWith('http')) {
        res.send({
            success: false,
            error: 'URL is invalid',
        });
        return;
    }
    // 1.2 Check the status is idle
    if (status !== ProcessStatus.IDLE) {
        res.send({
            success: false,
            error: 'Process is not idle',
        });
        return;
    }
    status = ProcessStatus.PROCESSING;
    // 2. Handle logic
    // 2.1 Call the service function to render the URL
    try {
        const data = yield (0, htmlRenderService_1.renderUrlToHtml)(url);
        // Convert the screenshot path to the public URL
        const requestUrl = req.hostname;
        const port = req.socket.localPort;
        const protocol = req.protocol;
        const baseUrl = `${protocol}://${requestUrl}:${port === 80 ? '' : port}`;
        const screenshot = baseUrl + '/' + data.screenshot.replace('./', '');
        data.screenshot = screenshot;
        const response = {
            success: true,
            data,
        };
        res.send(response);
    }
    catch (error) {
        res.send({
            success: false,
            error: error instanceof Error ? error.message : 'Unknown error',
        });
    }
    finally {
        status = ProcessStatus.IDLE;
    }
})));
// Allow to access the screenshots folder
app.use('/screenshots', (req, res, next) => {
    const screenshotPath = path_1.default.join(exports.screenshotDir, req.path);
    if (fs_1.default.existsSync(screenshotPath)) {
        res.sendFile(screenshotPath);
    }
    else {
        next();
    }
});
app.get('/api/status', (req, res) => {
    res.send({
        success: true,
        data: { status },
    });
});
app.listen(port, () => {
    console.log(`Server running at http://localhost:${port}`);
});
