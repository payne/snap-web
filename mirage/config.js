import Ember from 'ember';
import NLP from 'npm:nlp_compromise';

const { Logger: { info }} = Ember;

const house = ['house', 'mortgage', 'loan', 'refinance', '2nd', 'second'];
const appointment = ['teller', 'banker', 'in person', 'meeting', 'start', 'escrow', 'appointment', 'lender'];
const transactions = ['deposit', 'transfer', 'transaction', 'withdraw', 'escrow', 'payment'];
// const places = ['Block 16', 'Flat Iron Cafe'];
const spendEvents = ['lunch', 'dinner', 'go out', 'eat', 'repair', 'vacation'];
const accounts = ['college', 'funds', 'mine', 'partner'];
const location = ['branch'];

export default function() {

  this.get('/newsfeed', (schema) => {
    return schema.db.newsfeeds;
  });

  this.del('/newsfeed/:id');

  this.get('/transactions', (schema, request) => {
    let query = request.queryParams.query;
    let amount = request.queryParams.amount;
    let result;

    switch (query) {
      case 'transaction_filter_by_price':
        if (amount) {
          result = schema.db.transactions.filter(transaction => {
            return transaction.amount < amount;
          });
        }
        break;
    
      default:
        result = [];
        break;
    }

    return result;
  });

  this.get('/search', ({ suggestions }, request) => {
    // Get the search term.
    let search = request.queryParams.query;

    // Parse the search term as a sentance.
    let parsedQuestion = NLP.sentence(decodeURIComponent(search));

    // Filter out nouns, verbs, adjectives.  We don't really care about the
    // rest for now.
    let searchTerms = parsedQuestion.terms.filter(term => {
      return ['Actor', 'Adjective', 'Comparative', 'Infinitive', 'Noun', 'Verb'].includes(term.tag);
    });

    info('Search terms: ', searchTerms, ' Parsed Question: ', parsedQuestion);

    let canIResults = [];
    let showMeResults = [];

    // Check for a value only
    if (parsedQuestion.terms.length === 1 &&
        parsedQuestion.terms[0].tag === 'Value') {
      canIResults = canIResults.concat([{
        desc: `Spend $${parsedQuestion.terms[0].normal} today`,
        codeName: 'safe_to_spend',
        componentName: 'safe-to-spend',
        type: 'transaction',
        amount: parsedQuestion.terms[0].number
      }]);

      showMeResults = showMeResults.concat([{
        desc: `All transactions $${parsedQuestion.terms[0].normal} or less`,
        codeName: 'transaction_filter_by_price',
        componentName: 'transaction-list',
        type: 'transaction',
        amount: parsedQuestion.terms[0].number
      }]);
    }
    
    // TODO: check account to determine if they have a mortgage
    let houseTerms = searchTerms.filter(term => house.includes(term.normal));
    if (houseTerms.length) {
      canIResults = canIResults.concat([{
        desc: 'Buy a house soon',
        codeName: 'future_transaction_mortgage_app',
        componentName: 'appointment-scheduler',
        type: 'appointment'
      }]);

      showMeResults = showMeResults.concat([{
        desc: 'Start a mortage application',
        codeName: 'future_transaction_mortgage_app',
        componentName: 'appointment-scheduler',
        type: 'appointment'
      }]);
    }

    // Match appointments
    let appointmentTerms = searchTerms.filter(term => appointment.includes(term.normal));
    if (appointmentTerms.length) {
      showMeResults = showMeResults.concat([{
        desc: 'Schedule an appointment with a banker',
        codeName: 'appointment_setup_banker',
        componentName: 'appointment-scheduler',
        type: 'appointment'
      }, {
        desc: 'Schedule an appointment with a lender',
        codeName: 'appointment_setup_lender',
        componentName: 'appointment-scheduler',
        type: 'appointment'
      }, {
        desc: 'All branches with lenders and bankers',
        codeName: 'location_with_bankers_lenders',
        componentName: 'appointment-scheduler',
        type: 'appointment'
      }]);
    }

    // Match transactions
    let transactionTerms = searchTerms.filter(term => transactions.includes(term.normal));
    if (transactionTerms.length) {
      canIResults = canIResults.concat([{
        desc: 'Transfer money',
        codeName: 'transaction_money_transfer',
        componentName: 'create-transfer',
        type: 'transfer'
      }]);

      if (parsedQuestion.adjectives().filter(a => a.normal === 'all').length) {
        showMeResults = showMeResults.concat([{
          desc: 'Recent deposits',
          codeName: 'transaction_list_recent_deposits',
          componentName: 'create-transfer',
          type: 'transfer'
        }, {
          desc: 'Recent transfers',
          codeName: 'transaction_list_recent_tranfers',
          componentName: 'create-transfer',
          type: 'transfer'
        }, {
          desc: 'All future transactions',
          codeName: 'transaction_list_all_future',
          componentName: 'transaction-list',
          type: 'transaction'
        }, {
          desc: 'All past transactions this year',
          codeName: 'transaction_list_all_past_year',
          componentName: 'transaction-list',
          type: 'transaction'
        }]);
      } else {
        showMeResults = showMeResults.concat([{
          desc: 'Transactions over the last 5 days',
          codeName: 'transaction_list_last_5',
          componentName: 'transaction-list',
          type: 'transaction'
        }, {
          desc: `This month's transactions`,
          codeName: 'transaction_list_this_month',
          componentName: 'transaction-list',
          type: 'transaction'
        }, {
          desc: `Future transactions`,
          codeName: 'transaction_list_this_year',
          componentName: 'transaction-list',
          type: 'transaction'
        }]);
      }
    }

    // Match spend events
    let spendEventTerms = searchTerms.filter(term => spendEvents.includes(term.normal));
    if (spendEventTerms.length) {
      let value = '';
      let desc = '';

      if (parsedQuestion.values()[0]) {
        value = parsedQuestion.values()[0].text;
      }

      if (value) {
        desc = `Spend ${value} for ${spendEventTerms[0].normal}`;
      } else {
        desc = `Spend money on ${spendEventTerms[0].normal}`;
      }

      canIResults = canIResults.concat([{
        desc,
        codeName: 'safe_to_spend',
        componentName: 'safe-to-spend',
        type: 'transaction'
      }]);

      showMeResults = showMeResults.concat([{
        desc: `All ${spendEventTerms[0].normal} transactions`,
        codeName: 'transaction_filter_by_place',
        componentName: 'transaction-list',
        type: 'transaction'
      }, {
        desc: 'All restaurant transactions',
        codeName: 'transaction_filter_by_category',
        componentName: 'transaction-list',
        type: 'transaction'
      }]);
    }

    // Match on accounts
    let accountTerms = searchTerms.filter(term => accounts.includes(term.normal));
    if (accountTerms.length) {
      showMeResults = showMeResults.concat([{
        desc: 'All college funds',
        codeName: 'account_filter_by_college',
        componentName: 'account-list',
        type: 'accounts'
      }, {
        desc: 'All accounts',
        codeName: 'account_all',
        componentName: 'account-list',
        type: 'accounts'
      }, {
        desc: 'See investment accounts',
        codeName: 'account_investment',
        componentName: 'account-list',
        type: 'accounts'
      }]);
    }

    // Match on accounts
    let locationTerms = searchTerms.filter(term => location.includes(term.normal));
    if (locationTerms.length) {
      showMeResults = showMeResults.concat([{
        desc: 'Branch locations',
        codeName: 'location_branch_all',
        componentName: 'locations-map',
        type: 'location'
      }, {
        desc: 'All ATMs',
        codeName: 'location_atm_all',
        componentName: 'locations-map',
        type: 'location'
      }, {
        desc: 'All ATMs with deposit',
        codeName: 'location_atm_filter_deposit',
        componentName: 'locations-map',
        type: 'location'
      }, {
        desc: 'All drive-thrus',
        codeName: 'location_atm_filter_drive_thru',
        componentName: 'locations-map',
        type: 'location'
      }]);
    }

    return {
      canI: canIResults,
      showMe: showMeResults
    };
  });
  // passthrough to the node server that is middleware to slack.
  this.passthrough('http://localhost:1337/**');
}
