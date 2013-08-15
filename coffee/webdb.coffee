### global define ###

((root, factory) ->

    if typeof define is 'function' and define.amd
        define ['dbjs/defer', 'dbjs/db'], factory
    else
        root.kvDB = factory(root.Deferred, root.db)

    return

)(window, (deferred, DBjs) ->
    "use strict"

    TYPE_INDEXEDDB = 'indexeddb'
    TYPE_WEBSQL = 'websql'

    S4 = ->
      return Math.floor((1 + Math.random()) * 0x10000).toString(16).substring(1)
    
    GUID = ->
      return "#{ S4() }#{ S4() }-#{ S4() }-#{ S4() }-#{ S4() }-#{ S4() }#{ S4() }#{ S4() }"

    extend = (obj) ->

        obj2 = obj

        for arg in slice.call(arguments, 1)
            do (arg) ->
                for k, v of arg
                    if arg.hasOwnProperty(k)
                        obj2[k] = v

                return

        return obj2

    slice = Array::slice

    defaultConfig =
        id: GUID()
        version: '1'
        description: null
        schema: null
        # optional, required by websql
        size: 5 * 1024 * 1024  # 5 MB
        type: ( ->
            type = window.indexedDB or window.webkitIndexedDB or window.mozIndexedDB
            if not not type
                return TYPE_INDEXEDDB

            type = window.openDatabase
            if not not type
                return TYPE_WEBSQL

            throw 'Need IndexedDB or WebSQL supported in your browser.'
        )()

    class DBBase
        constructor: (@config) ->

    class IndexedDB extends DBBase

        open: ->
            config = @config
            config.server = config.id
            schema = config.schema
            dtd = deferred()

            @storeName = Object.keys(schema)[0]

            DBjs.open(config)
            .done (s) =>
                @_db = s
                dtd.resolve()
                return

            .fail ->
                dtd.reject()
                return

            return dtd

        close: ->
            return @_db.close()

        create: ->
            that = @_db[@storeName]
            return that.add.apply that, arguments

        get: (id) ->
            return @_db[@storeName].get id

        all: ->
            return @_db[@storeName].query().all().execute()

        remove: (id) ->
            return @_db[@storeName].remove id

        clear: ->
            return @_db[@storeName].clear()

        drop: ->
            return @_db.drop()

    class WebSQL extends DBBase
        _generateFieldsStatement: (fields, key) ->
            ###
            # Table fields example:
            #   fields: {
            #       field_name: {
            #           type: "TEXT",
            #           unique: true,
            #           default: "option default",
            #           notNull: true,
            #           autoIncrement: false
            #       }
            #   }
            ###

            fieldList = []
            gen = (name, type, options, primary = false) ->
                result = [name]

                result.push type

                if primary
                    result.push "PRIMARY KEY"

                if !!options.default
                    result.push "DEFAULT"
                    result.push options.default

                if options.autoIncrement
                    result.push "AUTOINCREMENT"
                else
                    if !!options.default
                        result.push "DEFAULT"
                        result.push "'#{ options.default }'"

                    if options.notNull
                        result.push "NOT NULL"

                return result.join(" ")

            primaryKey = key.keyPath
            primaryKeyOptions =
                autoIncrement: !!key.autoIncrement
                notNull: true

            if fields.hasOwnProperty primaryKey
                primaryKeyOptions = extend fields[primaryKey], primaryKeyOptions

            if primaryKeyOptions.autoIncrement
                primaryKeyOptions.type = 'INTEGER'
            else
                primaryKeyOptions.type = if primaryKeyOptions.type then primaryKeyOptions.type else 'TEXT'

            fieldList.push gen(primaryKey, primaryKeyOptions.type, primaryKeyOptions, true)

            for f in Object.keys(fields)
                if f is primaryKey
                    continue

                field = fields[f]
                fieldList.push gen(f, field.type, field, false)

            return fieldList.join(", ")

        _qmarks: (count) ->

            c = count
            array = []
            while c > 0
                array.push "?"
                c--

            return array.join ","

        open: ->
            that = @
            config = @config
            schema = config.schema
            dbName = config.id
            description = config.description or dbName
            storeName = Object.keys(schema)[0]
            fields = schema[storeName].fields
            key = schema[storeName].key
            version = config.version
            size = config.size
            dtd = deferred()

            if not fields
                throw "No fields defined in config object"

            db = openDatabase(dbName, version, description, size)

            db.transaction (transaction) ->
                ###
                # Table fields example:
                #   fields: {
                #       field_name: {
                #           type: "TEXT",
                #           unique: true,
                #           default: "option default",
                #           notNull: true,
                #           autoIncrement: false
                #       }
                #   }
                ###

                statement = that._generateFieldsStatement fields, key
                transaction.executeSql(
                    "CREATE TABLE IF NOT EXISTS #{ storeName } (#{ statement });"
                    null
                    ->
                        that._db = db
                        dtd.resolve()
                        return

                    ->
                        console.log statement
                        console.log "SQL statement error ", arguments[1]
                )
            return dtd

        create: ->
            that = @
            config = @config
            schema = config.schema
            storeName = Object.keys(schema)[0]
            records = slice.call arguments

            dtd = deferred()

            if !records
                dtd.reject()
                return dtd

            sqlStrings = []
            sqlValues = []
            for record in records
                fields = Object.keys(record)
                qmarks = @_qmarks(fields.length)
                sql = "INSERT INTO #{ storeName } (#{ fields.join(',') }) VALUES (#{ qmarks })"
                values = []
                values.push record[f] for f in fields

                sqlStrings.push sql
                Array::push.apply sqlValues, values

            
            # qmarks.push "?" for i in [0...fields.length]
            # values = []
            # values.push record[f] for f in fields

            @_db.transaction (transaction) ->
                
                successCallback = ->
                    dtd.resolve(record)

                errorCallback = ->
                    error = arguments[1]
                    if error.code is error.CONSTRAINT_ERR
                        that
                        .get(record.id)
                        .done (result) ->
                            dtd.resolve(result)
                            return

                        .fail ->
                            dtd.reject()
                            return

                    else
                        dtd.reject()

                transaction.executeSql(
                    sqlStrings.join(';')
                    sqlValues
                    successCallback
                    errorCallback
                )

            return dtd

        get: (id) ->
            config = @config
            schema = config.schema
            storeName = Object.keys(schema)[0]
            keyPath = schema[storeName].key.keyPath
            dtd = deferred()

            if not id
                dtd.reject()
                return dtd

            @_db.readTransaction (transaction) ->

                successCallback = ->
                    resultSet = arguments[1]
                    item = resultSet.rows.item 0
                    dtd.resolve item
                    return

                errorCallback = ->
                    console.log arguments[1]  # SQLException instance
                    dtd.reject()

                transaction.executeSql(
                    "SELECT * FROM #{ storeName } WHERE #{ keyPath }=?;"
                    [id]
                    successCallback
                    errorCallback
                )

            return dtd

        all: ->
            that = @
            config = @config
            schema = config.schema
            storeName = Object.keys(schema)[0]
            dtd = deferred()

            @_db.readTransaction (transaction) ->

                successCallback = ->
                    resultSet = arguments[1]
                    rows = resultSet.rows
                    result = []
                    i = 0
                    while true
                        try
                            item = rows.item i
                        catch e
                            item = null

                        if not item
                            break
                        else
                            result.push item
                            i++

                    dtd.resolve(result)
                    return

                errorCallback = ->
                    console.log("Select SQL statement error ", arguments[1])
                    dtd.reject()
                    return

                transaction.executeSql(
                    "SELECT * FROM #{ storeName };"
                    null
                    successCallback
                    errorCallback
                )

            return dtd

        remove: (id) ->
            config = @config
            schema = config.schema
            storeName = Object.keys(schema)[0]
            keyPath = schema[storeName].key.keyPath
            dtd = deferred()

            if not id
                dtd.reject()
                return dtd

            @_db.transaction (transaction) ->

                transaction.executeSql(
                    "DELETE FROM #{ storeName } WHERE #{ keyPath }=?;"
                    [id]
                    ->
                        dtd.resolve(id)
                    ->
                        console.log "Delete SQL statement error", arguments[1]
                        dtd.reject()
                )

            return dtd

        clear: ->
            config = @config
            schema = @config.schema
            storeName = Object.keys(schema)[0]
            dtd = deferred()

            @_db.transaction (transaction) ->

                transaction.executeSql(
                    "DELETE FROM #{ storeName }"
                    null
                    -> dtd.resolve()
                    ->
                        console.log "Clear SQL statement error", arguments[1]
                        dtd.reject()
                )

            return dtd

        # drop: ->
        #     throw "Not support delete database, see the spec 4.1 Databases"


    class Factory
        ACTIONS: ['create', 'get', 'all', 'remove', 'clear', 'drop', 'close']
        constructor: (config) ->
            _config = {}
            _config = extend defaultConfig, config
            @config = _config
        
        open: ->
            dtd = deferred()

            switch @config.type
                when TYPE_INDEXEDDB
                    db = new IndexedDB(@config)
                when TYPE_WEBSQL
                    db = new WebSQL(@config)
                else
                    throw 'Database type error'

            d = db.open()

            d.done =>

                instance = {}
                wrapper = (db, method) ->
                    return db[method].apply db, slice.call(arguments, 2)

                for k in Object.keys(Object.getPrototypeOf(db))
                    if @ACTIONS.indexOf(k) isnt -1
                        instance[k] = wrapper.bind instance, db, k

                dtd.resolve(instance)
                return

            d.fail ->
                dtd.reject()
                return

            return dtd

    Factory.TYPE_INDEXEDDB = TYPE_INDEXEDDB
    Factory.TYPE_WEBSQL = TYPE_WEBSQL

    return Factory
)
