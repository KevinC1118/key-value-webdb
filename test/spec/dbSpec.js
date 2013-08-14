/* global define */

define(['webdb'], function (WebDB) {
    'use strict';

    var indexedDB = window.indexedDB || window.webkitIndexedDB || window.mozIndexedDB || window.msIndexedDB || window.oIndexedDB;

    describe("Indexeddb", function () {

        var DB,
            config = {
                id: "webdb-test",
                schema: {
                    test: {
                        key: {
                            keyPath: 'id',
                            autoIncrement: true
                        },
                        fields: {
                            name: {
                                type: 'TEXT'
                            },
                            age: {
                                type: 'INTEGER'
                            }
                        }
                    }
                }
            },
            items = [{
                name: "Kevin",
                age: 20
            }, {
                name: "John",
                age: 25
            }, {
                name: "Chen",
                age: 30
            }];

        beforeEach(function () {
            var _config = config,
                done = false,
                webDB;
   
            _config.type = WebDB.TYPE_INDEXEDDB;
            webDB = new WebDB(_config);
            runs(function () {
                webDB.open().done(function (db) {
                    DB = db;
                    done = true;
                });
            });
    
            waitsFor(function () {
                return done;
            }, 'timeout for open indexedDB', 1000);
        });

        afterEach(function () {
            var done = false;
            if (DB) DB.close();
            runs(function () {
                var req = indexedDB.deleteDatabase(config.id);
                req.onsuccess = function () {
                    done = true;
                };
            });

            waitsFor(function () {
                return done;
            }, 'timeout for delete database', 1000);
        });

        it("open and close", function () {
            expect(DB.close).toBeDefined();
        });

        it("create", function () {
            var resultset = [],
                len, d;

            len = items.length;

            runs(function () {
                d = DB.create.apply(DB, items);
                d.done(function (rs) {
                    resultset = rs;
                });
            });

            waitsFor(function () {
                return resultset.length === len;
            }, 'timeout for add items', 1000);

            runs(function () {
                expect(resultset.length).toEqual(len);
            });
            
        });

        it('get', function () {

            var record, done = false;

            runs(function () {
                var d;

                d = DB.create.apply(DB, items);
                d.done(function () {
                    done = true;
                });
            });

            waitsFor(function () {
                return done;
            }, 'timeout for create items', 1000);

            runs(function () {
                var d;

                d = DB.get(1);

                d.done(function (r) {
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

        it('get all', function () {

            var resultset, done = false;

            runs(function () {
                var d;

                d = DB.create.apply(DB, items);
                d.done(function () {
                    done = true;
                });
            });

            waitsFor(function () {
                return done;
            }, 'timeout for create items', 1000);

            runs(function () {
                var d;

                d = DB.all();

                d.done(function (rs) {
                    resultset = rs;
                });
            });

            waitsFor(function () {
                return !!resultset;
            }, 'timeout for get item', 1000);

            runs(function () {
                expect(resultset.length).toEqual(items.length);
            });
        });

        it('remove', function () {

            var resultset, done = false, removekey = 1, returnkey;

            runs(function () {
                var d;

                d = DB.create.apply(DB, items);
                d.done(function () {
                    done = true;
                });
            });

            waitsFor(function () {
                return done;
            }, 'timeout for create items', 1000);

            runs(function () {
                var d, d2;

                d = DB.remove(removekey);

                d.done(function (k) {
                    returnkey = k;

                    d2 = DB.all();

                    d2.done(function (rs) {
                        resultset = rs;
                    });   
                });
            });

            waitsFor(function () {
                return !!resultset;
            }, 'timeout for remove item', 1000);

            runs(function () {
                expect(returnkey).toEqual(removekey);
                expect(resultset.length).toEqual(items.length - 1);
            });
        });

        it('clear', function () {

            var resultset, done = false;

            runs(function () {
                var d;

                d = DB.create.apply(DB, items);
                d.done(function () {
                    done = true;
                });
            });

            waitsFor(function () {
                return done;
            }, 'timeout for create items', 1000);

            runs(function () {
                var d, d2;

                d = DB.clear();

                d.done(function () {

                    d2 = DB.all();

                    d2.done(function (rs) {
                        resultset = rs;
                    });   
                });
            });

            waitsFor(function () {
                return !!resultset;
            }, 'timeout for get item', 1000);

            runs(function () {
                expect(resultset.length).toEqual(0);
            });
        });

    });
});
