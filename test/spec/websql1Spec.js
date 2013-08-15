/* global define */

define(['webdb'], function (WebDB) {
    'use strict';

    describe('database 1', function () {

        var DB,
            config = {
                id: 'db1',
                type: WebDB.TYPE_WEBSQL,
                schema: {
                    test: {
                        key: {
                            keyPath: 'id',
                            autoIncrement: true
                        },
                        fields: {
                            name: {
                                type: 'TEXT',
                                default: ''
                            }
                        }
                    }
                }
            },
            items = [{
                name: 'Kevin'
            }, {
                name: 'John'
            }];

        afterEach(function () {
            if (DB) {
                // DB.clear();
            }
        });

        it('open', function () {

            runs(function () {
                (new WebDB(config)).open().done(function (db) {
                    DB = db;
                });
            });

            waitsFor(function () {
                return !!DB;
            }, 'timeout for open database', 1000);

            runs(function () {
                expect(DB).toBeDefined();
            });
        });

        it('insert', function () {
            var record;

            runs(function () {
                DB.create.apply(DB, items).done(function (r) {
                    record = r;
                });
            });

            waitsFor(function () {
                return !!record;
            }, 'timeout for create items', 1000);

            runs(function () {
                expect(record.length).toEqual(items.length);
            });
        });

        it('get', function () {
            var record, key = 1;

            runs(function () {
                DB.get(key).done(function (r) {
                    record = r;
                });
            });

            waitsFor(function () {
                return !!record;
            }, 'timeout for get item', 1000);

            runs(function () {
                expect(record.name).toEqual(items[0].name);
            });
        });

        it('all', function () {
            var resultset;

            runs(function () {
                DB.all().done(function (rs) {
                    resultset = rs;
                });
            });

            waitsFor(function () {
                return !!resultset;
            }, 'timeout for fetch all items', 1000);

            runs(function () {
                expect(resultset.length).toEqual(items.length);
            });
        });

        it('remove', function () {
            var resultset, key = 1, removedkey;

            runs(function () {
                DB.remove(key).done(function (k) {
                    removedkey = k;
                });
            });

            waitsFor(function () {
                return !!removedkey;
            }, 'timeout for remove item', 1000);

            runs(function () {
                DB.all().done(function (rs) {
                    resultset = rs;
                });
            });

            waitsFor(function () {
                return !!resultset;
            }, 'timeout for fetch all items', 1000);

            runs(function () {
                expect(removedkey).toBe(key);
                expect(resultset.length).toBe(1);
            });
        });

        it('clear', function () {
            var done = false, resultset;

            runs(function () {
                DB.clear().done(function () {
                    done = true;
                });
            });

            waitsFor(function () {
                return done;
            }, 'timeout for clear', 1000);

            runs(function () {
                DB.all().done(function (rs) {
                    resultset = rs;
                });
            });

            waitsFor(function () {
                return !!resultset;
            }, 'timeout for fetch all items', 1000);

            runs(function () {
                expect(resultset.length).toEqual(0);
            });
        });
    });
});
