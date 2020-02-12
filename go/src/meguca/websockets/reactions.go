// Synchronization management message handlers

package websockets

import (
	"meguca/common"

	"encoding/json"
	"errors"
	"meguca/db"
	"meguca/feeds"
	"reflect"
	"smiles"
	"time"
)

type reactRequest struct {
	Smile    string `json:"smile"`
	Post     uint64 `json:"post"`
	ThreadID uint64 `json:"threadId"`
	Count    uint64 `json:"count"`
}

type reactRequests []reactRequest

var reactQueue reactRequests

func init() {
	go syncReacts()
}

func syncReacts() {
	time.Sleep(time.Second)

	ms := time.Tick(time.Millisecond * 500)

	for {
		select {
		case <-ms:
			threadMap := createMap(reactQueue)
			reactQueue = reactQueue[:0]
			for threadID, t := range threadMap {
				rs := handleReaction(t)
				sendToFeed(rs, threadID)
			}
		}
	}
}

type threadMap map[uint64]postMap
type postMap map[uint64]smileMap
type smileMap map[string]uint64

func isNil(v interface{}) bool {
	return v == nil ||
		(reflect.ValueOf(v).Kind() ==
			reflect.Ptr && reflect.ValueOf(v).IsNil())
}

func createMap(reactQueue reactRequests) threadMap {
	t := make(threadMap)
	p := make(postMap)

	// smileMap to PostIDs
	for _, r := range reactQueue {
		PostID := r.Post
		SmileID := r.Smile

		if p[PostID] == nil {
			p[PostID] = make(smileMap)
		}

		count := p[PostID][SmileID]
		if isNil(count) {
			count = 1
		} else {
			count++
		}

		p[PostID][SmileID] = count
	}

	// Map postMap to ThreadID
	for postID, m := range p {
		// fmt.Println(o, r)
		threadID, err := db.GetPostOP(postID)
		if err == nil {
			if t[threadID] == nil {
				t[threadID] = make(postMap)
			}
			t[threadID][postID] = m
		}
	}

	return t
}

func (c *Client) reactToPost(data []byte) error {
	var msg reactRequest
	err := decodeMessage(data, &msg)
	if err != nil {
		return err
	}

	if !smiles.Smiles[msg.Smile] {
		return errors.New("smile not found")
	}

	reactQueue = append(reactQueue, msg)

	if err != nil {
		return errors.New("couldn't REACT")
	}
	return nil
}

func handleReaction(p postMap) common.Reacts {
	var r common.Reacts
	for PostID, m := range p {
		for smileName, c := range m {
			exist := true
			count := db.GetPostReactCount(PostID, smileName)
			if count == 0 {
				exist = false
			}

			count = count + c
			if exist {
				db.UpdateReactionCount(PostID, smileName, count)
			} else {
				db.InsertPostReaction(PostID, smileName)
			}

			var re common.React
			re.SmileName = smileName
			re.Count = count
			re.PostID = PostID
			r = append(r, re)
		}
	}

	return r
}

type reactsMessage struct {
	Reacts common.Reacts `json:"reacts"`
}

func sendToFeed(r common.Reacts, threadID uint64) error {
	var rm reactsMessage
	rm.Reacts = r
	msgType := `30`
	t := make([]byte, 0, 1<<10)
	t = append(t, msgType...)

	msg, _ := json.Marshal(rm)

	t = append(t, msg...)
	feeds.SendTo(threadID, t)
	return nil
}
