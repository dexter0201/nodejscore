'use strict';

function Platform() {
}

Platform.isWin = function () {
    return process.platform === 'win32';
};

Platform.isMac = function () {
    return process.platform === 'darwin';
};

Platform.isLinux = function () {
    return process.platform === 'linux';
};

module.exports = function (NodeJsCore) {
    NodeJsCore.prototype.flatform = Platform;
};
