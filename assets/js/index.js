Vue.filter('formatDate', function (value) {
  if (value) {
    return moment(String(value)).format('DD/MM/YYYY h:mm a')
  }
});
Vue.filter("formatNumber", function (value) {
  return numeral(value).format("0,0");
});

let app = new Vue({
  el: '#app',
  data: {
    projects: [],
    experiments: [],
    experimentResults: null,
    selectedProject: null,
    selectedExperiment: null,
    experimentsRetrieved: false,
    apiSettings: {
      baseUrl: 'https://api.optimizely.com/v2',
      state: 'REOOptimizely',
      clientId: '20499801277'
    },
    authenticated: false
  },
  methods: {
    load: function () {
      axios.get('/projects', {
        params: {
          per_page: 100
        }
      }).then(
        response => {
          this.projects = response.data
            .sort((a, b) => a.name.localeCompare(b.name));
        }
      );
    },
    getExperimentsForProject: function () {
      this.experiments = [];
      this.selectedExperiment = null;
      this.experimentResults = null;
      this.experimentsRetrieved = false;
      axios.get('/experiments', {
        params: {
          project_id: this.selectedProject,
          per_page: 100
        }
      }).then(
        response => {
          this.experiments = response.data
            .filter(e => e.status === "running" || e.status === "paused")
            .sort((a, b) => b.status.localeCompare(a.status) || a.name.localeCompare(b.name));
          var runningIndex = this.experiments.findIndex(e => e.status === 'running');
          if (runningIndex > -1) {
            this.experiments.splice(runningIndex, 0, {});
          }
          var pausedIndex = this.experiments.findIndex(e => e.status === 'paused');
          if (pausedIndex > -1) {
            this.experiments.splice(pausedIndex, 0, {});
          }
          this.experimentsRetrieved = true;
        }
      );
    },
    getExperimentResults: function () {
      this.experimentResults = null;
      axios.get('/experiments/' + this.selectedExperiment + '/results').then(
        response => {
          this.experimentResults = response.data;
        }
      );
    },
    sortVariations: function (results) {
      return Object.keys(results)
        .map(key => results[key])
        .sort((a, b) => (b.is_baseline - a.is_baseline) || a.name.localeCompare(b.name));
    },
    getSignificance: function (result) {
      if (result.lift) {
        if (result.lift.significance > 0.95) {
          if (result.lift.lift_status === "worse") {
            return "Loser";
          } else {
            return "Winner";
          }
        } else if (result.lift.significance < 0.01) {
          return "<1%";
        } else {
          return parseFloat(result.lift.significance * 100).toFixed(0) + "%";
        }
      }
      return "--";
    },
    getRate: function (result) {
      if (result.rate) {
        return parseFloat(result.rate * 100).toFixed(2) + "%";
      }
      return "--";
    },
    getLift: function (result) {
      if (result.lift && result.lift.value && result.lift.value != -1) {
        var sign = result.lift.value > 0 ? "+" : "";
        return sign + parseFloat(result.lift.value * 100).toFixed(2) + "%";
      }
      return "";
    },
    getWinnerLoserClass: function (result) {
      if (result.lift && result.lift.significance >= 0.95) {
        if (result.lift.lift_status === "worse") {
          return "loser";
        } else {
          return "winner";
        }
      }
    },
    getLiftStatusIndicator: function (result) {
      if (result.lift && result.rate > 0) {
        if (result.lift.lift_status === "worse") {
          return "&darr;";
        }
        if (result.lift.lift_status === "better") {
          return "&uarr;";
        }
        return "";
      }
    },
    getLiftStatusClass: function (result) {
      if (result.lift && result.rate > 0) {
        if (result.lift.lift_status === "worse") {
          return "worse";
        }
        if (result.lift.lift_status === "better") {
          return "better";
        }
        return "";
      }
    },
    getExperimentStatus: function (experimentId) {
      return this.experiments.find(e => e.id === experimentId).status;
    },
    getPreviewUrl: function (experimentId, result) {
      var variation = this.experiments.find(e => e.id === experimentId)
        .variations.find(v => v.variation_id == result.variation_id);
      if (variation && variation.actions.length > 0) {
        return variation.actions[0].share_link;
      } else {
        return '';
      }
    },
    setApiDefaults: function () {
      axios.defaults.baseURL = this.apiSettings.baseUrl;
      axios.interceptors.response.use(response => {
        return response;
      }, error => {
        if (error.response.status === 401 || error.response.status === 403) {
          this.reauthenticate();
        }
        return error;
      });
    },
    checkAccessToken: function () {
      var hash = window.location.hash;
      var accessTokenMatches = /access_token=([^&]+)&/g.exec(hash);
      var accessToken = accessTokenMatches ? accessTokenMatches[1] : null;
      var stateMatches = /state=([^&]+)&/g.exec(hash);
      var state = stateMatches ? stateMatches[1] : null;
      if (accessToken && state === this.apiSettings.state) {
        axios.defaults.headers.common['Authorization'] = 'Bearer ' + accessToken;
        this.authenticated = true;
      } else {
        this.reauthenticate();
      }
    },
    reauthenticate: function () {
      var clientId = this.apiSettings.clientId;
      var redirectUrl = encodeURIComponent(window.location.protocol + "//" + window.location.host + window.location.pathname);
      var responseType = 'token';
      var scopes = 'All';
      var url = 'https://app.optimizely.com/oauth2/authorize?client_id=' + clientId
        + '&redirect_uri=' + redirectUrl
        + '&response_type=token'
        + '&scopes=all'
        + '&state=' + this.apiSettings.state;
      window.location.href = url;
    }
  },
  created: function () {
    this.checkAccessToken();
    this.setApiDefaults();
    this.load();
  }
})
