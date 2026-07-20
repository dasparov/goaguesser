import { mount } from 'svelte'
import '../app.css'
import Curator from './Curator.svelte'

const app = mount(Curator, {
  target: document.getElementById('app')!,
})

export default app
