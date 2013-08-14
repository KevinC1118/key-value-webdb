/* global define */

define(['webdb'], function (WebDB) {
    'use strict';

    describe('IndexedDB', function () {
        it('drop', function () {
            var webDB,
                DB,
                done = false,
                config = {
                    id: "webdb-drop-test",
                    schema: {
                        test: {
                            key: {
                                keyPath: 'id',
                                autoIncrement: true
                            }
                        }
                    }
                };

            webDB = new WebDB(config);

            runs(function () {
                webDB.open().done(function (db) {
                    DB = db;
                });
            });

            waitsFor(function () {
                return !!DB;
            }, 'timeout for open database', 1000);

            runs(function () {
                DB.drop().done(function () {
                    done = true;
                });
            });

            waitsFor(function () {
                return done;
            }, 'timeout for drop database', 1000);

            runs(function () {
                try {
                    DB.all();
                } catch (e) {
                    expect(e).toBe('Database has been closed');
                }
            });
        });
    });
});
