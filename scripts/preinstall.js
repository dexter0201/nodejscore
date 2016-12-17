'use strict';

var chalk = require('chalk');

process.argv.forEach(function (arg) {
    if (['-g', '--global'].indexOf(arg) > -1) {
        console.log(chalk.green('Please install "nodejscore-cli" globally instead of "nodejscore" as:'));
        console.log('');
        console.log(chalk.blue('    $npm install -g nodejscore-cli'));
        console.log('');
        process.exit(1);
    }
});
