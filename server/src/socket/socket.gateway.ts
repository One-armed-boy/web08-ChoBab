import { InjectModel } from '@nestjs/mongoose';
import { OnModuleInit } from '@nestjs/common';
import {
  MessageBody,
  WebSocketGateway,
  WebSocketServer,
  SubscribeMessage,
  OnGatewayInit,
  OnGatewayConnection,
  OnGatewayDisconnect,
  ConnectedSocket,
} from '@nestjs/websockets';
import { Room, RoomDocument } from '@room/room.schema';
import { Model } from 'mongoose';
import { Server, Socket } from 'socket.io';
import { sessionMiddleware } from '@utils/session';
import { Request, Response, NextFunction } from 'express';
import { PreprocessedRestaurantType as RestaurantType } from '@restaurant/restaurant';
import { ConnectRoomDto } from '@socket/dto/connect-room.dto';
import { makeUserRandomNickname } from '@utils/nickname';
import { RedisService } from '@cache/redis.service';

interface UserType {
  userId: string;
  userLat: number;
  userLng: number;
}

@WebSocketGateway({ namespace: 'room' })
export class EventsGateway
  implements OnGatewayInit, OnGatewayConnection, OnGatewayDisconnect, OnModuleInit
{
  @WebSocketServer()
  server: Server; // 'room' namespace server instance

  constructor(
    @InjectModel(Room.name) private roomModel: Model<RoomDocument>,
    private readonly redisService: RedisService
  ) {}

  private socketRes() {
    const dataTemplate = (message: string, data?: unknown) => {
      if (!data) {
        return { message };
      }
      return {
        message,
        data,
      };
    };
    return {
      CONNECT_FAIL: dataTemplate('접속 실패'),
      CONNECT_SUCCESS: (
        roomCode: string,
        lat: number,
        lng: number,
        restaurantList: RestaurantType[],
        candidateList: { [index: string]: number },
        userList: { [index: string]: UserType },
        userId: string,
        userName: string
      ) =>
        dataTemplate('접속 성공', {
          roomCode,
          lat,
          lng,
          restaurantList,
          candidateList,
          userList,
          userId,
          userName,
        }),
    };
  }

  onModuleInit() {
    this.server.use((socket, next) => {
      sessionMiddleware(socket.request as Request, {} as Response, next as NextFunction);
    });

    this.server.use((socket: Socket, next) => {
      const req = socket.request;

      Object.assign(socket, { sessionID: req.sessionID });

      next();
    });
  }

  @SubscribeMessage('connectRoom')
  async handleConnectRoom(
    @ConnectedSocket() client: Socket,
    @MessageBody() connectRoomDto: ConnectRoomDto
  ) {
    const { roomCode, userLat, userLng } = connectRoomDto;

    client.roomCode = roomCode;

    client.join(roomCode);

    const { CONNECT_SUCCESS, CONNECT_FAIL } = this.socketRes();

    try {
      const { lat, lng } = await this.roomModel.findOne({ roomCode });
      const restaurantList = await this.redisService.restaurantList.getRestaurantListForRoom(
        roomCode
      );
      const { sessionID: userId } = client.request;
      const user = { userId, userLat, userLng, userName: makeUserRandomNickname() };
      await this.redisService.joinList.addUserToJoinList(roomCode, user);
      const candidateList = await this.redisService.candidateList.getCandidateList(roomCode);
      const newUserList = await this.redisService.joinList.getJoinList(roomCode);

      client.emit(
        'connectResult',
        CONNECT_SUCCESS(
          roomCode,
          lat,
          lng,
          restaurantList,
          candidateList,
          newUserList,
          user.userId,
          user.userName
        )
      );

      client.to(roomCode).emit('join', user); // 자신을 제외하네?
    } catch (error) {
      client.emit('connectResult', CONNECT_FAIL);
    }
  }

  afterInit() {
    console.log('connection initialize');
  }

  handleConnection() {
    console.log('connected');
  }

  async handleDisconnect(client: Socket) {
    const { sessionID, roomCode } = client;

    // 같은 방의 접속자 세션 아이디를 전부 가져오는 작업
    const roomSessionIDs =
      this.server.sockets instanceof Map
        ? [...this.server.sockets]
            .filter(([key, value]) => value.roomCode === roomCode)
            .map(([key, value]) => value.sessionID)
        : [];

    // 방안에 같은 세션 접속자가 없을 때 퇴장 처리 (DB, Client 에서 모두 제거)
    if (!roomSessionIDs.includes(sessionID)) {
      await this.redisService.joinList.delUserToJoinList(roomCode, sessionID);

      client.to(roomCode).emit('leave', sessionID);
    }

    console.log('disconnected');
  }
}
