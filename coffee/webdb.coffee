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
            storeName = Object.keys(schema)[0]
            dtd = deferred()

            DBjs.open(config)
            .done (s) =>
                @config._db = s[storeName]
                dtd.resolve()
                return

            .fail ->
                dtd.reject()
                return

            return dtd

        close: ->
            config = @config
            return config._db.close()

        create: (data) ->
            config = @config
            return config._db.add data

        get: (id) ->
            config = @config
            return config._db.get id

        all: ->
            config = @config
            return config._db.query().all().execute()

        remove: (id) ->
            config = @config
            return config._db.remove id

        clear: ->
            config = @config
            return config._db.clear()

        drop: ->
            config = @config
            return config._db.drop()

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

                if options.notNull
                    result.push "NOT NULL"

                if !!options.default
                    result.push "DEFAULT"
                    result.push options.default

                if options.autoIncrement
                    result.push "AUTOINCREMENT"

                return result.join(" ")

            primaryKey = fields[key.keyPath]
            primaryKeyOptions =
                autoIncrement: key.autoIncrement
                notNull: true

            fieldList.push gen(key.keyPath, primaryKey.type, primaryKeyOptions, true)

            for f in Object.keys(fields)
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

                transaction.executeSql(
                    "CREATE TABLE IF NOT EXISTS #{ storeName } (#{ that._generateFieldsStatement fields, key });"
                    null
                    ->
                        that.config._db = db
                        dtd.resolve()
                        return

                    -> console.log "SQL statement error ", arguments[1]
                )
            return dtd

        close: ->
            # No supported

        create: (data) ->
            that = @
            config = @config
            schema = config.schema
            storeName = Object.keys(schema)[0]
            record = data
            dtd = deferred()

            if not record
                dtd.reject()
                return dtd

            fields = Object.keys(record)
            qmarks = []
            qmarks.push "?" for i in [0...fields.length]
            values = []
            values.push record[f] for f in fields

            config._db.transaction (transaction) ->
                
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
                    "INSERT INTO #{ storeName } (#{ fields.join(',') }) VALUES (#{ qmarks });"
                    values
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

            config._db.transaction (transaction) ->

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

            config._db.transaction (transaction) ->

                successCallback = ->
                    resultSet = arguments[1]
                    rows = resultSet.rows
                    result = []
                    i = 0
                    while true
                        item = rows.item i
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

            config._db.transaction (transaction) ->

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

            config._db.transaction (transaction) ->

                transaction.executeSql(
                    "DELETE FROM #{ storeName }"
                    null
                    -> dtd.resolve()
                    ->
                        console.log "Clear SQL statement error", arguments[1]
                        dtd.reject()
                )

            return dtd

        drop: ->
            throw "Not support delete database, see the spec 4.1 Databases"


    class Factory
        ACTIONS: ['open', 'create', 'get', 'all', 'remove', 'clear', 'drop', 'close']

        constructor: (config) ->

            _config = {}
            
            _config = extend defaultConfig, config
            @config = _config
        
        _open: ->

            dtd = deferred()

            if !!@config._db
                dtd.resolve()
                return dtd

            switch @config.type
                when TYPE_INDEXEDDB
                    new IndexedDB(@config)
                when TYPE_WEBSQL
                    new WebSQL(@config)
                else
                    throw 'Type error'

            d = @config._db.open()

            d.done ->
                dtd.resolve()
                return

            d.fail ->
                dtd.reject()
                return

            return dtd

        do: (actionName) ->

            if typeof actionName isnt 'string'
                throw "Not string."

            if @ACTIONS.indexOf(actionName) is -1
                throw "No command named \"#{ actionName }\""

            if actionName is @ACTIONS[0]
                return @_open()

            return @_DB[actionName].apply @_DB, slice.call(arguments, 1)

    fun = (config = defaultConfig) ->
        return new Factory(config)

    fun.TYPE_INDEXEDDB = TYPE_INDEXEDDB
    fun.TYPE_WEBSQL = TYPE_WEBSQL

    return fun
)
