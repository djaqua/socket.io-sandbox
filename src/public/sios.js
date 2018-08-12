/**
 * var bootstrap loads modules
 *
 * @param  {type} client        description the instance of SIOSClient to configure
 * @param  {type} configuration description a JSON object with the following structure
 *                               {
 *                                  "uuid": 767697-6757667rt-45e5e5-7656u6,
 *                                  "modules": ["m1", "m2", ...],
 *                                  "m1" : {...},
 *                                  "m2" : {...},
 *                                  ...
 *                               }
 */
var bootstrap = function(client, configuration, env) {

  client.getConfiguration = function() {
    return configuration;
  };

  var modules = configuration.modules;
  if (configuration.modules === '*') {
    modules = _.keys(SIOSClient.modules);
    configuration.modules = modules;
  }

  for (var i = 0; i < modules.length; i++) {
    SIOSClient.modules[modules[i]](client, configuration, env);
  }
};



/**
 * SIOSClient - description
 *
 * @return {type}  description
 */
function SIOSClient() {

  var args = Array.prototype.slice.apply(arguments);
  var callback = args.pop();

  if (!(this instanceof SIOSClient)) {
    return new SIOSClient(args, callback);
  }

  var env = {
    socket: io(),
    el: args[0],
  };

  var self = this;
  env.socket.on('bootstrap', function(configuration) {

    // first, bootstrap the system
    bootstrap(self, configuration, env);

    // then release control
    if (callback) {
        callback(self);
    };
  });
}



/**
 * var getOrCreateList - lazy initializer for lists that modules need to share
 *
 * @param  {type} env      map of unique run-time tweaks
 * @param  {type} listName the name of the list to get or create
 * @return {type}          the property of env identified by 'listName'
 */
var getOrCreateList = function(env, listName) {
  if (!env[listName]) {
    env[listName] = [];
  }
  return env[listName];
};


/**
 * var using - determines if the configuration from the server supports the
 * dependenciesfor this module
 *
 * @param  {object} configuration an object with a modules property
 * @param  {array}  dependencies  description
 * @return {boolean}               description
 */
var using = function(configuration, dependencies) {
  return configuration.modules !== '*' || _.forEach(dependencies, function(dep) {
    return _.includes(configuration.modules, dep);
  });
};


/**
 * A map to store the SIOSClient modules in
 */
SIOSClient.modules = {

  /**
   * dom - responsible for
   *
   * @param  {type} client        description
   * @param  {type} configuration description
   * @param  {type} env           description
   * @return {type}               description
   */
    'dom' : function(client, configuration, env) {
        var $el = $(env.el || configuration.el || 'body');
        client.get$Root = function() {
            return $el;
        };
    },

  /**
   * users - description
   *
   * @param  {type} client        description
   * @param  {type} configuration description
   * @param  {type} env           description
   * @return {type}               description
   */
   'users' : function(client, configuration, env) {

         var users = [];
         client.getUsers = function() {
             return users;
         };

         env.socket.on('users', function(data) {
             var oldUsers = users;
             users = data.users;
             _.forEach(getOrCreateList(env, 'usersListeners'), function(listener) {
                 listener.handleUsersEvent(oldUsers, users);
             });
         });
     },


    /**
     * broadcast - description
     *
     * @param  {type} client        description
     * @param  {type} configuration description
     * @param  {type} env           description
     * @return {type}               description
     */
    'broadcast' : function(client, configuration, env) {
        env.socket.on('broadcast', function(data) {

            if (data.user) {
                _.forEach(getOrCreateList(env, 'userBroadcastListeners'), function(listener) {
                    listener.handleUserBroadcastEvent(data.user, data.message);
                });
            }
            else {
                _.forEach(getOrCreateList(env, 'serverBroadcastListeners'), function(listener) {
                    listener.handleServerBroadcastEvent(data.message);
                });
            }
        });
    },


  /**
   * messaging - description
   *
   * @param  {type} client        description
   * @param  {type} configuration description
   * @param  {type} env           description
   * @return {type}               description
   */
  'broadcastRendering' : function(client, configuration, env) {

    if (!using(configuration, ['dom', 'broadcast'])) {
      return; // module dependencies not met
    }

    if (using(configuration, ['users'])) {
        // 'users' module is optional and supported by this module
        client.handleUserBroadcastEvent = function(user, message) {
            var $broadcast = $('<broadcast />');
            $broadcast.addClass('user');
            $broadcast.append('<user>' + user + ':</user>');
            $broadcast.append('<message>' + message + '</message>');

            client['get$Root']().append($broadcast);
        };
        getOrCreateList(env, 'userBroadcastListeners').push(client);
    }

    client.handleServerBroadcastEvent = function(message) {
        var $broadcast = $('<broadcast />');
        $broadcast.append('<message>' + message + '</message>');

        client['get$Root']().append($broadcast);
    };
    getOrCreateList(env, 'serverBroadcastListeners').push(client);
  }
};
