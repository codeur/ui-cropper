'use strict';
var argv         = require('minimist')(process.argv.slice(2)),
    gulp         = require('gulp'),
    header       = require('gulp-header'),
    gutil        = require('gulp-util'),
    ngAnnotate   = require('gulp-ng-annotate'),
    sass         = require('gulp-sass'),
    refresh      = require('gulp-livereload'),
    prefix       = require('gulp-autoprefixer'),
    cleanCSS     = require('gulp-clean-css'),
    uglify       = require('gulp-uglify'),
    clean        = require('gulp-rimraf'),
    concat       = require('gulp-concat-util'),
    express      = require('express'),
    express_lr   = require('connect-livereload'),
    tinylr       = require('tiny-lr'),
    opn          = require('opn'),
    runSequence  = require('run-sequence'),
    eslint       = require('gulp-eslint'),
    pkg          = require('./package.json'),
    lr,
    refresh_lr;

var today = new Date();

// Configuration

var Config = {
    port: 9000,
    livereloadPort: 35728,
    testPage: 'example/index.html',
    cache: (typeof argv.cache !== 'undefined' ? !!argv.cache : true),
    paths: {
        source: {
            root: 'source',
            js: 'source/js',
            scss: 'source/scss'
        },
        tmp: '.tmp/unminified',
        compileUnminified: {
            root: 'compile/unminified',
            js: 'compile/unminified',
            css: 'compile/unminified'
        },
        compileMinified: {
            root: 'compile/minified',
            js: 'compile/minified',
            css: 'compile/minified'
        }
    },
    banners: {
        unminified: '/*!\n' +
        ' * ' + pkg.prettyName + ' v' + pkg.version + '\n' +
        ' * ' + pkg.homepage + '\n' +
        ' *\n' +
        ' * Copyright (c) ' + (today.getFullYear()) + ' ' + pkg.author.name + '\n' +
        ' * License: ' + pkg.license + '\n' +
        ' *\n' +
        ' * Generated at ' + gutil.date(today, 'dddd, mmmm dS, yyyy, h:MM:ss TT') + '\n' +
        ' */',
        minified: '/*! ' + pkg.prettyName + ' v' + pkg.version + ' License: ' + pkg.license + ' */'
    }
};

// Tasks
// =====

// Compile Styles
gulp.task('styles', function () {
    return gulp.src(Config.paths.source.scss + '/ui-cropper.scss')
        .pipe(sass())
        .pipe(prefix({
            browsers: ['last 2 version', '> 5%', 'safari 5', 'ie 8', 'ie 7', 'opera 12.1', 'ios 6', 'android 4']
        }))
        .pipe(gulp.dest(Config.paths.compileUnminified.css), {overwrite: true});
});

// Compile Scripts
gulp.task('scripts-part-1', function () {
    return gulp.src([
        Config.paths.source.js + '/init.js',
        Config.paths.source.js + '/classes/*.js',
        Config.paths.source.js + '/ui-cropper.js'
    ])
        .pipe(concat('ui-cropper' + '.js', {
            separator: '\n\n',
            process: function (src) {
                // Remove all 'use strict'; from the code and
                // replaces all double blank lines with one
                return src.replace(/\r\n/g, '\n')
                    .replace(/'use strict';\n+/g, '')
                    .replace(/\n\n\s*\n/g, '\n\n');
            }
        }))
        .pipe(concat.header(Config.banners.unminified + '\n' +
            '(function() {\n\'use strict\';\n\n'))
        .pipe(concat.footer('\n}());'))
        .pipe(gulp.dest(Config.paths.tmp));
});

gulp.task('scripts-part-2', function () {
    return gulp.src([
        Config.paths.tmp + '/ui-cropper' + '.js',
        Config.paths.source.js + '/3rdparty/!(exif).js'
    ])
        .pipe(concat('ui-cropper' + '.js', {
            separator: '\n\n',
            process: function (src) {
                // Remove all 'use strict'; from the code and
                // replaces all double blank lines with one
                return src.replace(/\r\n/g, '\n')
                    .replace(/'use strict';\n+/g, '')
                    .replace(/\n\n\s*\n/g, '\n\n');
            }
        }))
        .pipe(gulp.dest(Config.paths.compileUnminified.js));
});

gulp.task('scripts', function () {
    runSequence('scripts-part-1', 'scripts-part-2');
});

// Make a Distrib
gulp.task('dist:js:clean', function () {
    return gulp.src([Config.paths.compileMinified.root + '/**/*.js'], {read: false})
        .pipe(clean());
});
gulp.task('dist:css:clean', function () {
    return gulp.src([Config.paths.compileMinified.root + '/**/*.css'], {read: false})
        .pipe(clean());
});
gulp.task('dist:js', ['scripts', 'dist:js:clean'], function () {
    return gulp.src(Config.paths.compileUnminified.js + '/**/*.js')
        .pipe(ngAnnotate())
        .pipe(uglify())
        .pipe(header(Config.banners.minified))
        .pipe(gulp.dest(Config.paths.compileMinified.js));
});
gulp.task('dist:css', ['dist:css:clean', 'styles'], function () {
    return gulp.src(Config.paths.compileUnminified.css + '/**/*.css')
        .pipe(cleanCSS())
        .pipe(gulp.dest(Config.paths.compileMinified.css), {overwrite: true});
});

// Server
gulp.task('server', function () {
    express()
        .use(express_lr())
        .use(express.static('.'))
        .listen(Config.port);
    gutil.log('Server listening on port ' + Config.port);
});

// LiveReload
gulp.task('livereload', function () {
    lr = tinylr();
    lr.listen(Config.livereloadPort, function (err) {
        if (err) {
            gutil.log('Livereload error:', err);
        }
    });
    refresh_lr = refresh(lr);
});

// Watches
gulp.task('watch', function () {
    gulp.watch(Config.paths.source.scss + '/**/*.scss', ['styles']);
    gulp.watch([Config.paths.source.js + '/**/*.js'], ['scripts']);
    gulp.watch([
        Config.paths.compileUnminified.css + '/**/*.css',
        Config.paths.compileUnminified.js + '/**/*.js',
        Config.testPage
    ], function (evt) {
        refresh_lr.changed(evt.path);
    });
});


// User commands
// =============

// Code linter
gulp.task('lint', function () {
    return gulp.src([Config.paths.source.js + '/**/*.js', '!' + Config.paths.source.js + '/3rdparty/*.js'])
        .pipe(eslint())
        .pipe(eslint.format())
        .pipe(eslint.failAfterError());
});

// Build
gulp.task('build', ['dist:js', 'dist:css']);

// Start server and watch for changes
gulp.task('default', ['server', 'livereload', 'styles', 'scripts', 'watch'], function () {
    // use the -o arg to open the test page in the browser
    if (argv.o) {
        opn('http://localhost:' + Config.port + '/' + Config.testPage);
    }
});
