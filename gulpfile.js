/***
 * Copyright (C) 2018 Qli5. All Rights Reserved.
 * 
 * @author qli5 <goodlq11[at](163|gmail).com>
 * 
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/.
*/

/*************************************************/
/***************   Build Configs   ***************/
const gitPath = 'D:\\Program Files\\Git\\bin\\git';
const npmPath = 'npm';
const includeSourcemap = false;
/*************************************************/

const fs = require('fs');
const spawn = require('child_process').spawn;
const rollup = require('rollup');
const gulp = require('gulp');
const concat = require('gulp-concat');
const sourcemaps = require('gulp-sourcemaps');
const rename = require('gulp-rename');
const babel = require('gulp-babel');
const jsxac = require('jsx-append-child');

gulp.task('default', ['build']);
gulp.task('build', ['biliTwin.user.js', 'biliTwinBabelCompiled.user.js']);

gulp.task('biliTwin.user.js', ['./src/bilitwin.js'], () => {
    if (!includeSourcemap) {
        return gulp.src(['./src/bilitwin.meta.js', './src/bilitwin.js'])
            .pipe(sourcemaps.init({ loadMaps: true }))
            .pipe(concat('biliTwin.user.js'))
            .pipe(gulp.dest('.'));
    }
    else {
        return gulp.src(['./src/bilitwin.meta.js', './src/bilitwin.js'])
            .pipe(sourcemaps.init({ loadMaps: true }))
            .pipe(concat('biliTwin.user.js'))
            .pipe(sourcemaps.write('.', {
                sourceMappingURLPrefix: 'https://raw.githubusercontent.com/liqi0816/bilitwin/develop'
            }))
            .pipe(gulp.dest('.'));
    }
});

gulp.task('biliTwinBabelCompiled.user.js', ['biliTwin.user.js'], () => {
    return gulp.src('biliTwin.user.js')
        .pipe(babel({
            presets: ['babel-preset-env']
        }))
        .pipe(rename('biliTwinBabelCompiled.user.js'))
        .pipe(gulp.dest('.'));
});

gulp.task('./src/bilitwin.js', ['./src/ui/ui.js', './src/assconverter/interface.js', './src/flvass2mkv/interface.js'], async () => {
    const bundle = await rollup.rollup({
        input: './src/bilitwin.entry.js'
    });
    return bundle.write({
        file: './src/bilitwin.js',
        format: 'es',
        sourcemap: includeSourcemap,
    })
});

gulp.task('./src/ui/ui.js', () => {
    return gulp.src('./src/ui/ui.entry.js')
        .pipe(babel({
            plugins: [jsxac],
            sourceMaps: 'inline'
        }))
        .pipe(rename('ui.js'))
        .pipe(gulp.dest('./src/ui/'));
});

gulp.task('./src/assconverter/interface.js', async () => new Promise(resolve => {
    fs.access('./src/assconverter/interface.js', fs.constants.R_OK, e => {
        if (e) {
            spawn(gitPath, ['submodule', 'init'], { shell: true }).once('close', () => {
                spawn(gitPath, ['submodule', 'update'], { shell: true }).once('close', resolve);
            });
        }
        else {
            resolve();
        }
    })
}));

gulp.task('./src/flvass2mkv/interface.js', async () => new Promise(resolve => {
    fs.access('./src/flvass2mkv/interface.js', fs.constants.R_OK, e => {
        if (e) {
            spawn(npmPath, ['install'], { cwd: 'src/flvass2mkv', shell: true }).once('close', resolve);
        }
        else {
            resolve();
        }
    })
}));

gulp.task('watch', () => {
    return gulp.watch(['src/*.js', 'src/*/*.js'], { delay: 5000 }, ['build']);
});
