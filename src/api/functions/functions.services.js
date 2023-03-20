const axios = require('axios')
const { accessToken } = require('../../utils/twitch')

const fetchSubscriptions = async () => {
  const token = await accessToken()
  const { data } = await axios.get('https://api.twitch.tv/helix/eventsub/subscriptions', {
    headers: {
      Authorization: `Bearer ${token}`,
      'Client-ID': process.env.TWITCH_CLIENT_ID
    }
  })
  return data.data
}

module.exports = {
  fetchSubscriptions
}
