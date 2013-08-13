### globalstrict ###
### globals: define ###
"use strict"
((root, factory) ->

    if typeof define is 'function' and define.amd
        define ['dbjs/defer', 'dbjs/db'], factory
    else
        root.kvDB = factory(root.Deferred, root.db)

)(@, (Deferred, DBjs) ->

    TYPE_INDEXEDDB = 'indexeddb'
    TYPE_WEBSQL = 'websql'

    S4 = ->
      return Math.floor((1 + Math.random()) * 0x10000).toString(16).substring(1)
    
    GUID = ->
      return "#{ s4() }#{ s4() }-#{ s4() }-#{ s4() }-#{ s4() }-#{ s4() }#{ s4() }#{ s4() }"

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
        websql:  # option, but required by websql
            size: 5 * 1024 * 1024  # 5 MB
        type: ( ->
            type = window.indexedDB or window.webkitIndexedDB or window.mozIndexedDB
            if not not type
                return TYPE_INDEXEDDB

            type = window.openDatabase
            if not not type
                return TYPE_WEBSQL

            throw Error('Need IndexedDB or WebSQL supported in your browser.')
        )()

    class DBBase
        constructor: (@config) ->

    class IndexedDB extends DBBase

        open: ->
            config = @config
            config.server = config.id
            schema = config.schema
            storeName = Object.keys(schema)[0]
            dtd = Deferred()

            DBjs.open(config)
            .done (s) =>
                @config._db = s[storeName]
                dtd.resolve()
                return

            .fail ->
                dtd.reject()
                return

            return

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
            dtd = Deferred()

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
            dtd = Deferred()

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
            dtd = Deferred()

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
            dtd = Deferred()

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
            dtd = Deferred()

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
            dtd = Deferred()

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
        DO_OPEN: 'open'
        DO_CREATE: 'create'
        DO_READ: 'read'
        DO_READALL: 'readall'
        DO_REMOVE: 'remove'
        DO_CLEAR: 'clear'
        DO_DROP: 'drop'

        constructor: (config) ->

            _config = {}
            
            _config = extend defaultConfig, config
            @config = _config
        
        open: ->

            dtd = Deferred()

            if !!@DB
                dtd.resolve()
                return dtd

            switch @config.type
                when TYPE_INDEXEDDB
                    @DB = new IndexedDB(@config)
                    d = @DB.open()
                when TYPE_WEBSQL
                    @DB = new WebSQL(@config)
                    d = @DB.open()
                else
                    throw 'Type error'

            d.done ->
                dtd.resolve()
                return

            d.fail ->
                dtd.reject()
                return

            return dtd

        do: (actionName) ->

            if typeof actionName isnt 'string'
                throw "Do command must be string."

            if !@hasOwnProperty "DO_#{ actionName.toUpperCase() }"
                throw "No command named \"#{ actionName }\""

            if actionName is @DO_OPEN
                return @open.apply @, slice(arguments, 1)

            return @DB[actionName].apply @DB, slice.call(arguments, 1)

    return (config = defaultConfig) ->
        return new Factory(config)
)
